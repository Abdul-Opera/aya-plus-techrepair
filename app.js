// =========================================================================
// ANTI-PIRACY & CORE SYSTEM INITIALIZATION
// =========================================================================
const SECRET_SALT = "TECH_REPAIR_NIGERIA_2026_PRO";

function generateHardwareID() {
    const info = [navigator.userAgent.replace(/[^a-zA-Z]/g, ""), screen.width, screen.height, navigator.hardwareConcurrency || 4, SECRET_SALT].join("-");
    let hash = 0;
    for (let i = 0; i < info.length; i++) {
        hash = (hash << 5) - hash + info.charCodeAt(i);
        hash |= 0; 
    }
    return "HWID-" + Math.abs(hash);
}

function isValidLicenseKey(hwid, inputtedKey) {
    let checkHash = 0;
    const validationString = hwid + SECRET_SALT + "LICENSED";
    for (let i = 0; i < validationString.length; i++) {
        checkHash = (checkHash << 5) - checkHash + validationString.charCodeAt(i);
        checkHash |= 0;
    }
    return inputtedKey === ("KEY-" + Math.abs(checkHash));
}

if (!localStorage.getItem('techrepair_license_key') || !isValidLicenseKey(generateHardwareID(), localStorage.getItem('techrepair_license_key'))) {
    if (!window.location.href.includes('license.html')) window.location.href = 'license.html';
}

if (localStorage.getItem('isRepairAppLoggedIn') !== 'true') window.location.href = 'login.html';
if (!localStorage.getItem('workshop_user')) {
    localStorage.setItem('workshop_user', 'admin');
    localStorage.setItem('workshop_pass', '12345');
}

// Global Variables
let jobs = JSON.parse(localStorage.getItem('repairJobsPro')) || [];
let dailyExpenses = JSON.parse(localStorage.getItem('repairDailyExpenses')) || [];
let toolExpenses = JSON.parse(localStorage.getItem('repairToolExpenses')) || [];
let currentView = 'active';
let editingJobId = null;

// Theme Controller
document.addEventListener('DOMContentLoaded', function() {
    const themeBtn = document.getElementById('darkModeToggle');
    if (themeBtn) {
        themeBtn.innerText = localStorage.getItem('repairAppTheme') === 'dark' ? '☀️ Light Mode' : '🌓 Dark Mode';
        document.documentElement.setAttribute('data-theme', localStorage.getItem('repairAppTheme') || 'light');
        themeBtn.addEventListener('click', function() {
            let newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            themeBtn.innerText = newTheme === 'dark' ? '☀️ Light Mode' : '🌓 Dark Mode';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('repairAppTheme', newTheme);
        });
    }
    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').addEventListener('click', function() {
            if (confirm('Log out?')) { localStorage.removeItem('isRepairAppLoggedIn'); window.location.href = 'login.html'; }
        });
    }
});


//==============================================================================

// =========================================================================
// TAB NAVIGATOR & WORKSHOP RENDERING ENGINE
// =========================================================================
function switchView(view) {
    currentView = view;
    const tabs = ['tabActive', 'tabArchive', 'tabReports', 'tabDailyExpenses', 'tabToolExpenses', 'tabSettings'];
    tabs.forEach(t => { if(document.getElementById(t)) document.getElementById(t).classList.toggle('active', t.toLowerCase().includes(view.toLowerCase())); });
    
    if(document.getElementById('formCard')) document.getElementById('formCard').style.display = (view==='active'||view==='archive') ? 'block' : 'none';
    if(document.getElementById('logDataPanel')) document.getElementById('logDataPanel').style.display = (view==='active'||view==='archive') ? 'block' : 'none';
    if(document.getElementById('settingsPanel')) document.getElementById('settingsPanel').style.display = (view==='settings') ? 'block' : 'none';
    if(document.getElementById('reportsPanel')) document.getElementById('reportsPanel').style.display = (view==='reports') ? 'block' : 'none';
    if(document.getElementById('dailyExpensesPanel')) document.getElementById('dailyExpensesPanel').style.display = (view==='dailyExpenses') ? 'block' : 'none';
    if(document.getElementById('toolExpensesPanel')) document.getElementById('toolExpensesPanel').style.display = (view==='toolExpenses') ? 'block' : 'none';

    if (view === 'settings') {
        if(document.getElementById('newUsername')) document.getElementById('newUsername').value = localStorage.getItem('workshop_user');
    } else if (view === 'reports') { calculateFinancialReports(); }
    else if (view === 'dailyExpenses') { renderDailyExpenses(); }
    else if (view === 'toolExpenses') { renderToolExpenses(); }
    else { if(document.getElementById('searchBox')) document.getElementById('searchBox').value = ''; renderTable(); }
}

function renderTable() {
    const tbody = document.getElementById('inventoryTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    let filtered = jobs.filter(j => currentView === 'active' ? !j.isArchived : j.isArchived);
    const search = document.getElementById('searchBox') ? document.getElementById('searchBox').value.toLowerCase() : '';
    if (search) filtered = filtered.filter(j => j.id.toLowerCase().includes(search) || j.customer.toLowerCase().includes(search) || j.phone.includes(search) || j.gadget.toLowerCase().includes(search));

    if (currentView === 'archive') {
        let totalFinances = filtered.reduce((s, j) => s + j.totalCost, 0);
        if(document.getElementById('archiveCount')) document.getElementById('archiveCount').innerText = filtered.length;
        if(document.getElementById('archiveFinancesTotal')) document.getElementById('archiveFinancesTotal').innerText = '₦' + totalFinances.toLocaleString();
        if(document.getElementById('archiveSummaryBanner')) document.getElementById('archiveSummaryBanner').style.display = 'flex';
    } else { if(document.getElementById('archiveSummaryBanner')) document.getElementById('archiveSummaryBanner').style.display = 'none'; }

    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">No records found.</td></tr>`; return; }

    filtered.forEach(job => {
        const balance = job.totalCost - job.depositPaid;
        const row = document.createElement('tr');
        if (currentView === 'active') {
            let sCls = job.status==='Fixing' ? 'status-fixing' : (job.status==='Ready' ? 'status-ready' : 'status-pending');
            row.innerHTML = `
                <td><span class="id-badge">${job.id}</span><br><small>${job.date}</small></td>
                <td><strong>${job.gadget}</strong><br><small>Fault: ${job.problem}</small></td>
                <td>${job.customer}<br><small>${job.phone}</small></td>
                <td>Cost: ₦${job.totalCost.toLocaleString()}<br>Paid: ₦${job.depositPaid.toLocaleString()}<br><b>Bal: ₦${balance.toLocaleString()}</b></td>
                <td>
                    <select class="status-select ${sCls}" onchange="updateStatus('${job.id}', this.value)">
                        <option value="Pending" ${job.status==='Pending'?'selected':''}>Pending</option>
                        <option value="Fixing" ${job.status==='Fixing'?'selected':''}>Fixing</option>
                        <option value="Ready" ${job.status==='Ready'?'selected':''}>Ready</option>
                    </select>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; gap: 2px;">
                            <button class="action-btn" onclick="collectJob('${job.id}')" style="flex: 1;">Collect</button>
                            <button class="print-btn" onclick="reprintTicket('${job.id}')" style="flex: 1;">🎫 Slip</button>
                        </div>
                        <button class="print-btn" onclick="startEdit('${job.id}')" style="background-color: #f59e0b; color: white;">✏️ Edit</button>
                    </div>
                </td>`;
        } else {
            row.innerHTML = `<td><span class="id-badge archive-badge">${job.id}</span></td><td><small>Opened: ${job.date}</small><br><small style="color:var(--success)">Picked: ${job.collectedDate}</small></td><td><strong>${job.gadget}</strong></td><td>${job.customer}</td><td>₦${job.totalCost.toLocaleString()}</td><td><button class="print-btn" onclick="reprintTicket('${job.id}')">🎫 Slip</button><button class="print-btn" style="background:#ef4444;" onclick="deletePermanent('${job.id}')">🗑️</button></td>`;
        }
        tbody.appendChild(row);
    });
}


if (document.getElementById('searchBox')) document.getElementById('searchBox').addEventListener('input', renderTable);
function updateStatus(id, stat) { const j = jobs.find(x => x.id === id); if(j) { j.status = stat; localStorage.setItem('repairJobsPro', JSON.stringify(jobs)); renderTable(); } }

//==========================================================================================


// =========================================================================
// ACTION SUBMISSIONS, EXPENSES MANAGEMENT & CALCULATORS
// =========================================================================

// Fill out fields automatically when Edit button is clicked
function startEdit(id) {
    const job = jobs.find(x => x.id === id);
    if (!job) return;
    editingJobId = id;
    if(document.getElementById('gadgetName')) document.getElementById('gadgetName').value = job.gadget;
    if(document.getElementById('customerName')) document.getElementById('customerName').value = job.customer;
    if(document.getElementById('customerPhone')) document.getElementById('customerPhone').value = job.phone;
    if(document.getElementById('estimatedCost')) document.getElementById('estimatedCost').value = job.totalCost;
    if(document.getElementById('depositPaid')) document.getElementById('depositPaid').value = job.depositPaid;
    if(document.getElementById('initialStatus')) document.getElementById('initialStatus').value = job.status;
    if(document.getElementById('gadgetProblem')) document.getElementById('gadgetProblem').value = job.problem;

    const btn = document.querySelector('#repairForm button[type="submit"]');
    if (btn) { btn.innerText = `Update Repair Ticket (${id})`; btn.style.backgroundColor = "#ea580c"; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Handles both saving NEW tickets and UPDATING existing ones
if (document.getElementById('repairForm')) {
    document.getElementById('repairForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const cost = parseFloat(document.getElementById('estimatedCost').value) || 0;
        const dep = parseFloat(document.getElementById('depositPaid').value) || 0;
        
        if (editingJobId) {
            // --- EDIT SUBMIT MODE ---
            const jobIndex = jobs.findIndex(j => j.id === editingJobId);
            if (jobIndex !== -1) {
                jobs[jobIndex].gadget = document.getElementById('gadgetName').value;
                jobs[jobIndex].customer = document.getElementById('customerName').value;
                jobs[jobIndex].phone = document.getElementById('customerPhone').value;
                jobs[jobIndex].totalCost = cost;
                jobs[jobIndex].depositPaid = dep;
                jobs[jobIndex].status = document.getElementById('initialStatus').value;
                jobs[jobIndex].problem = document.getElementById('gadgetProblem').value;
                showReceipt(jobs[jobIndex]);
            }
            editingJobId = null;
            const btn = document.querySelector('#repairForm button[type="submit"]');
            if (btn) { btn.innerText = "Save Repair & Generate Ticket"; btn.style.backgroundColor = ""; }
        } else {
            // --- NEW TICKET MODE ---
            const newJob = { id: 'REPAIR-' + Math.floor(1000 + Math.random() * 9000), date: new Date().toLocaleDateString(), collectedDate: null, gadget: document.getElementById('gadgetName').value, customer: document.getElementById('customerName').value, phone: document.getElementById('customerPhone').value, problem: document.getElementById('gadgetProblem').value, totalCost: cost, depositPaid: dep, status: document.getElementById('initialStatus').value, isArchived: false };
            jobs.push(newJob);
            showReceipt(newJob);
        }
        
        localStorage.setItem('repairJobsPro', JSON.stringify(jobs));
        renderTable();
        document.getElementById('repairForm').reset();

        if (liveBalanceDisplay) liveBalanceDisplay.innerText = '₦0';

    });
}

function collectJob(id) { const j = jobs.find(x => x.id === id); if(j && confirm(`Collect device for ${j.customer}?`)) { j.isArchived = true; j.collectedDate = new Date().toLocaleDateString(); j.depositPaid = j.totalCost; localStorage.setItem('repairJobsPro', JSON.stringify(jobs)); renderTable(); } }
function deletePermanent(id) { if(confirm('Wipe history entry?')) { jobs = jobs.filter(x => x.id !== id); localStorage.setItem('repairJobsPro', JSON.stringify(jobs)); renderTable(); } }

function showReceipt(j) {
    const bal = j.isArchived ? 0 : (j.totalCost - j.depositPaid);
    document.getElementById('recId').innerText = j.id; document.getElementById('recDate').innerText = j.date; document.getElementById('recGadget').innerText = j.gadget; document.getElementById('recName').innerText = j.customer; document.getElementById('recPhone').innerText = j.phone; document.getElementById('recFault').innerText = j.problem; document.getElementById('recTotal').innerText = '₦' + j.totalCost.toLocaleString(); document.getElementById('recDeposit').innerText = '₦' + j.depositPaid.toLocaleString(); document.getElementById('recBalance').innerText = '₦' + bal.toLocaleString();
    document.getElementById('receiptPopup').style.display = 'block'; document.getElementById('overlay').style.display = 'block';
}
function reprintTicket(id) { const j = jobs.find(x => x.id === id); if(j) showReceipt(j); }
function closeReceipt() { document.getElementById('receiptPopup').style.display = 'none'; document.getElementById('overlay').style.display = 'none'; }


//=========================================================================
// Expense Form Listeners
document.addEventListener('DOMContentLoaded', function() {

        // =========================================================================
    // INGESTION FORM REAL-TIME BALANCE ENGINE (NEW)
    // =========================================================================
    const costInput = document.getElementById('estimatedCost');
    const depositInput = document.getElementById('depositPaid');
    const liveBalanceDisplay = document.getElementById('liveBalanceCalc');
    const liveBalanceBox = document.getElementById('liveBalanceContainer');

    function updateLiveBalanceBox() {
        if (!costInput || !depositInput || !liveBalanceDisplay) return;
        
        const totalCost = parseFloat(costInput.value) || 0;
        const depositPaid = parseFloat(depositInput.value) || 0;
        const balanceDue = totalCost - depositPaid;

        // Display formatted Currency output live
        liveBalanceDisplay.innerText = '₦' + balanceDue.toLocaleString();

        // Dynamically color-code the badge to prevent financial intake errors
        if (balanceDue < 0) {
            liveBalanceDisplay.style.color = '#ef4444'; // Red for negative math errors
            liveBalanceBox.style.background = 'rgba(239, 68, 68, 0.08)';
            liveBalanceBox.style.borderColor = '#ef4444';
        } else if (balanceDue === 0 && totalCost > 0) {
            liveBalanceDisplay.style.color = '#16a34a'; // Green for completely paid up jobs
            liveBalanceBox.style.background = 'rgba(22, 163, 74, 0.08)';
            liveBalanceBox.style.borderColor = '#16a34a';
        } else {
            liveBalanceDisplay.style.color = 'var(--primary)'; // Standard business theme
            liveBalanceBox.style.background = 'rgba(37, 99, 235, 0.08)';
            liveBalanceBox.style.borderColor = 'var(--primary)';
        }
    }

    // Bind execution listeners to input event streams
    if (costInput) costInput.addEventListener('input', updateLiveBalanceBox);
    if (depositInput) depositInput.addEventListener('input', updateLiveBalanceBox);

    //===============================================================
    const dForm = document.getElementById('dailyExpenseForm');
    const tForm = document.getElementById('toolExpenseForm');
    if (dForm) {
        dForm.addEventListener('submit', function(e) {
            e.preventDefault();
            dailyExpenses.push({ id: 'EXP-'+Date.now(), date: new Date().toLocaleDateString(), desc: document.getElementById('dailyExpenseDesc').value, amount: parseFloat(document.getElementById('dailyExpenseAmount').value)||0 });
            localStorage.setItem('repairDailyExpenses', JSON.stringify(dailyExpenses)); dForm.reset(); renderDailyExpenses();
        });
    }
    if (tForm) {
        tForm.addEventListener('submit', function(e) {
            e.preventDefault();
            toolExpenses.push({ id: 'TOOL-'+Date.now(), date: new Date().toLocaleDateString(), desc: document.getElementById('toolExpenseDesc').value, amount: parseFloat(document.getElementById('toolExpenseAmount').value)||0 });
            localStorage.setItem('repairToolExpenses', JSON.stringify(toolExpenses)); tForm.reset(); renderToolExpenses();
        });
    }
        // Master Backup Download Trigger
    if(document.getElementById('exportBtn')) {
        document.getElementById('exportBtn').addEventListener('click', function() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ jobsData: jobs, dailyExpensesData: dailyExpenses, toolExpensesData: toolExpenses }));
            const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", `ayaplus_master_backup_${new Date().toISOString().slice(0,10)}.json`);
            document.body.appendChild(dl); dl.click(); dl.remove();
        });
    }

        // Master Backup Restore Trigger (PERMANENTLY FIXED)
    if (document.getElementById('importBtn')) {
        document.getElementById('importBtn').addEventListener('click', function() {
            const fileInput = document.getElementById('importFile');
            
            if (!fileInput || fileInput.files.length === 0) {
                alert("⚠️ Error: Please select an 'ayaplus_master_backup.json' file first!");
                return;
            }

            // FIX 1: Extract the single file object directly here using [0]
            const actualFile = fileInput.files[0]; 
            const reader = new FileReader();

            reader.onload = function(event) {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    if (!importedData.jobsData || !importedData.dailyExpensesData || !importedData.toolExpensesData) {
                        alert("❌ Error: Invalid backup file format! This is not an AYA_PLUS master dataset.");
                        return;
                    }

                    if (confirm("🔄 Warning: Restoring this file will overwrite all current workshop database logs on this device. Do you want to proceed?")) {
                        jobs = importedData.jobsData;
                        dailyExpenses = importedData.dailyExpensesData;
                        toolExpenses = importedData.toolExpensesData;

                        localStorage.setItem('repairJobsPro', JSON.stringify(jobs));
                        localStorage.setItem('repairDailyExpenses', JSON.stringify(dailyExpenses));
                        localStorage.setItem('repairToolExpenses', JSON.stringify(toolExpenses));

                        alert("🎉 Database Restored Successfully!");
                        
                        fileInput.value = '';
                        switchView(currentView);
                    }
                } catch (error) {
                    alert("❌ Error: Failed to parse backup file. The JSON format might be corrupted.");
                }
            };

            // FIX 2: Pass the single file object into the reader
            reader.readAsText(actualFile);
        });
    }

        // =========================================================================
    // EXPENSE SEARCH EVENT STREAM LISTENERS (PASTE EXACTLY HERE)
    // =========================================================================
    if (document.getElementById('searchDailyExpenses')) {
        document.getElementById('searchDailyExpenses').addEventListener('input', renderDailyExpenses);
    }
    if (document.getElementById('searchToolExpenses')) {
        document.getElementById('searchToolExpenses').addEventListener('input', renderToolExpenses);
    }
    // =========================================================================

}); // <--- This is the closing brace of your DOMContentLoaded block


function renderDailyExpenses() {
    const tbody = document.getElementById('dailyExpensesTable'); if (!tbody) return; tbody.innerHTML = '';
    
    // Calculate total layout from all items regardless of search
    let total = dailyExpenses.reduce((s, i) => s + i.amount, 0);
    if (document.getElementById('totalDailyExpensesBanner')) document.getElementById('totalDailyExpensesBanner').innerText = '₦' + total.toLocaleString();
    
    // Apply search filter
    const searchVal = document.getElementById('searchDailyExpenses') ? document.getElementById('searchDailyExpenses').value.toLowerCase() : '';
    let filtered = dailyExpenses;
    if (searchVal) {
        filtered = dailyExpenses.filter(i => i.desc.toLowerCase().includes(searchVal) || i.date.includes(searchVal));
    }

    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:gray;">No matching expenses found.</td></tr>`; return; }
    filtered.forEach(i => { tbody.innerHTML += `<tr><td>${i.date}</td><td>${i.desc}</td><td>₦${i.amount.toLocaleString()}</td><td><button class="print-btn" style="background:#ef4444; padding:4px;" onclick="deleteDailyExpense('${i.id}')">🗑️</button></td></tr>`; });
}


function renderToolExpenses() {
    const tbody = document.getElementById('toolExpensesTable'); if (!tbody) return; tbody.innerHTML = '';
    
    let runningToolTotal = toolExpenses.reduce((s, i) => s + i.amount, 0);
    if (document.getElementById('totalToolExpensesBanner')) document.getElementById('totalToolExpensesBanner').innerText = '₦' + runningToolTotal.toLocaleString();
    
    // Apply search filter
    const searchVal = document.getElementById('searchToolExpenses') ? document.getElementById('searchToolExpenses').value.toLowerCase() : '';
    let filtered = toolExpenses;
    if (searchVal) {
        filtered = toolExpenses.filter(i => i.desc.toLowerCase().includes(searchVal) || i.date.includes(searchVal));
    }

    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:gray;">No matching tool records found.</td></tr>`; return; }
    filtered.forEach(i => { tbody.innerHTML += `<tr><td>${i.date}</td><td>${i.desc}</td><td>₦${i.amount.toLocaleString()}</td><td><button class="print-btn" style="background:#ef4444; padding:4px;" onclick="deleteToolExpense('${i.id}')">🗑️</button></td></tr>`; });
}



function deleteDailyExpense(id) { dailyExpenses = dailyExpenses.filter(x => x.id !== id); localStorage.setItem('repairDailyExpenses', JSON.stringify(dailyExpenses)); renderDailyExpenses(); }
function deleteToolExpense(id) { toolExpenses = toolExpenses.filter(x => x.id !== id); localStorage.setItem('repairToolExpenses', JSON.stringify(toolExpenses)); renderToolExpenses(); }

function calculateFinancialReports() {
    let pipeline = jobs.reduce((s, j) => !j.isArchived ? s + j.totalCost : s, 0);
    let deposits = jobs.reduce((s, j) => !j.isArchived ? s + j.depositPaid : s, 0);
    let outstanding = pipeline - deposits;
    let income = jobs.reduce((s, j) => j.isArchived ? s + j.totalCost : s, 0);
    let totalExp = dailyExpenses.reduce((s, i) => s + i.amount, 0) + toolExpenses.reduce((s, i) => s + i.amount, 0);

    if (document.getElementById('statPipeline')) document.getElementById('statPipeline').innerText = '₦' + pipeline.toLocaleString();
    if (document.getElementById('statDeposits')) document.getElementById('statDeposits').innerText = '₦' + deposits.toLocaleString();
    if (document.getElementById('statOutstanding')) document.getElementById('statOutstanding').innerText = '₦' + outstanding.toLocaleString();
    if (document.getElementById('statTotalExpenses')) document.getElementById('statTotalExpenses').innerText = '₦' + totalExp.toLocaleString();
    if (document.getElementById('statDailyProfit')) document.getElementById('statDailyProfit').innerText = '₦' + (income - totalExp).toLocaleString();
}

// Start app view cleanly
switchView('active');

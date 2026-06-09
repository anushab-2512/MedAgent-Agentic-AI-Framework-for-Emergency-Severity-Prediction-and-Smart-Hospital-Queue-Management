const API_URL = 'http://127.0.0.1:5000';

// ==========================================
// UI Initialization & Navigation
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Dynamic Profile Role
    const role = localStorage.getItem("userRole") || "Receptionist";
    document.getElementById('displayRole').innerText = `👤 ${role}`;
    
    // 2. Setup Dropdowns (Profile & Notifications)
    const profileSection = document.getElementById('profileSection');
    const profileDropdown = document.getElementById('profileDropdown');
    const notifSection = document.getElementById('notificationSection');
    const notifDropdown = document.getElementById('notificationDropdown');
    
    profileSection.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
        notifDropdown.classList.remove('show'); // close the other
    });
    
    notifSection.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('show');
        profileDropdown.classList.remove('show'); // close the other
        
        // Reset badge when opened
        unreadNotifs = 0;
        updateNotifBadge();
    });
    
    document.addEventListener('click', () => {
        profileDropdown.classList.remove('show');
        notifDropdown.classList.remove('show');
    });
    
    // 3. Setup Sidebar Tab Switching
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if(!item.hasAttribute('data-target')) return;
            
            const targetId = item.getAttribute('data-target');
            switchTab(targetId);
        });
    });
    
    // 4. Initialize Charts
    initCharts();
});

function getUserRole() {
    return localStorage.getItem("userRole") || "Receptionist";
}

function canMarkConsulted() {
    const allowed = new Set(["Doctor", "Receptionist", "Ward Staff"]);
    return allowed.has(getUserRole());
}

// Function to switch between views
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => {
        if(n.getAttribute('data-target') === tabId) {
            n.classList.add('active');
        } else {
            n.classList.remove('active');
        }
    });
}

function logoutUser() {
    localStorage.removeItem("isLoggedIn");
    window.location.href = "login.html";
}

// ==========================================
// Notifications Logic
// ==========================================
let unreadNotifs = 0;
function addNotification(message, icon = '🔔') {
    const list = document.getElementById('notificationList');
    if(!list) return;
    
    const emptyMsg = list.querySelector('.empty-notif');
    if(emptyMsg) emptyMsg.remove();
    
    const div = document.createElement('div');
    div.className = 'notif-item';
    
    div.innerHTML = `
        <div><span class="notif-icon">${icon}</span> ${message}</div>
        <span class="notif-time">🕒 Just now</span>
    `;
    
    list.insertBefore(div, list.firstChild);
    
    // Keep max 20 notifications
    if (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
    
    unreadNotifs++;
    updateNotifBadge();
}

function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if(!badge) return;
    if(unreadNotifs > 0) {
        badge.innerText = unreadNotifs;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// Initial mockup notification
setTimeout(() => {
    addNotification("Dashboard initialized", "✅");
}, 1000);


// ==========================================
// Add New Patient Logic
// ==========================================
document.getElementById('patientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const patientData = {
        name: document.getElementById('pName').value,
        age: parseInt(document.getElementById('pAge').value),
        sex: document.getElementById('pSex').value,
        address: document.getElementById('pAddress').value,
        occupation: document.getElementById('pOccupation').value,
        education: document.getElementById('pEducation').value,
        symptoms: document.getElementById('pSymptoms').value,
        admission_date: document.getElementById('pAdmissionDate').value,
        examination_date: document.getElementById('pExaminationDate').value,
        heart_rate: parseFloat(document.getElementById('pHR').value),
        oxygen: parseFloat(document.getElementById('pO2').value),
        temperature: parseFloat(document.getElementById('pTemp').value)
    };

    try {
        const res = await fetch(`${API_URL}/add-patient`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientData)
        });
        const data = await res.json();
        console.log("Added:", data);
        document.getElementById('patientForm').reset();
        
        // Refresh everything
        fetchQueue();
        fetchPatients();
        
        addNotification("New patient registered", "🩺");
        
        // Optionally auto-switch to queue tab after admit
        switchTab('view-queue');
    } catch (e) {
        alert("Error adding patient");
    }    
});


// ==========================================
// Smart Hospital Queue Logic
// ==========================================
let currentQueue = [];

async function fetchQueue() {
    try {
        const res = await fetch(`${API_URL}/get-queue`);
        const data = await res.json();
        const prevQueueLength = currentQueue.length;
        currentQueue = data.queue;
        
        // Push notification if new patient is added to queue dynamically
        if (prevQueueLength > 0 && currentQueue.length > prevQueueLength) {
            addNotification("Queue updated successfully", "✅");
        }
        
        // Look for critical patients
        const criticalCount = currentQueue.filter(q => q.severity === 'Critical').length;
        if (criticalCount > 0 && criticalCount > (window._lastCriticalCount || 0)) {
            addNotification("Critical patient detected", "⚠");
        }
        window._lastCriticalCount = criticalCount;
        
        renderQueueList(currentQueue);
        renderCurrentQueueTable(currentQueue);
        updateDashboardStats();
        updateCharts(currentQueue);
        updateReportsAnalytics(currentQueue);
        renderMonitoringCards(currentQueue);
    } catch (e) {
        console.error("Queue fetch error", e);
    }
}

// 1. Render traditional list view for Smart Hospital Queue tab
function renderQueueList(queue) {
    const list = document.getElementById('queueList');
    if(!list) return;
    
    document.getElementById('queueCount').innerText = `${queue.length} Patients`;
    list.innerHTML = '';
    
    if (queue.length === 0) {
        list.innerHTML = '<p style="color: gray; text-align: center;">Queue is empty</p>';
        return;
    }

    queue.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `queue-item ${item.severity}`;
        
        let sevIcon = '🟢';
        if (item.severity === 'Critical') sevIcon = '🔴';
        else if (item.severity === 'High') sevIcon = '🟠';
        else if (item.severity === 'Medium') sevIcon = '🟡';
        
        const data = item.data || {};
        const hr = data.heart_rate ? parseFloat(data.heart_rate).toFixed(1) : '--';
        const o2 = data.oxygen ? parseFloat(data.oxygen).toFixed(1) : '--';
        const temp = data.temperature ? parseFloat(data.temperature).toFixed(1) : '--';
        const name = data.name || 'Unknown';
        
        div.innerHTML = `
            <div class="q-header">
                <strong>Patient ID: ${item.patient_id}</strong>
                <span class="q-pos">Queue Pos: #${index + 1}</span>
            </div>
            <div class="q-name">Name: <strong>${name}</strong></div>
            <div class="q-vitals">
                <div class="q-vital-box">HR <span>${hr}</span></div>
                <div class="q-vital-box">SpO₂ <span>${o2}%</span></div>
                <div class="q-vital-box">Temp <span>${temp}°C</span></div>
            </div>
            <div class="q-footer">
                <span class="sev-badge sev-${item.severity}">${sevIcon} ${item.severity}</span>
                <span style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Wait: ${Math.floor(item.waiting_time_sec / 60)}m ${Math.floor(item.waiting_time_sec % 60)}s</span>
            </div>
            <div class="q-actions">
                <button class="btn-consulted" onclick="consultPatient('${item.patient_id}')">Consulted</button>
            </div>
        `;
        list.appendChild(div);
    });
}

async function consultPatient(patientId) {
    if (!canMarkConsulted()) {
        alert("Access Denied");
        addNotification("Access Denied", "⛔");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/consult_patient/${encodeURIComponent(patientId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (!res.ok || data.status === 'error') {
            alert(data.message || "Error marking patient as consulted");
            return;
        }

        addNotification("Patient marked as consulted successfully", "✅");
        alert("Patient marked as consulted successfully");

        await fetchQueue();
        await fetchPatients();
        switchTab('view-consulted');
    } catch (e) {
        console.error("Consult patient error", e);
        alert("Error marking patient as consulted");
    }
}

// 2. Render Current Queue Table for Dashboard tab
function renderCurrentQueueTable(queue) {
    const tbody = document.getElementById('currentQueueTableBody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    if (queue.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:gray; padding: 2rem;">No patients currently in queue</td></tr>';
        return;
    }
    
    queue.forEach((item) => {
        const tr = document.createElement('tr');
        const data = item.data || {};
        const name = data.name || 'Unknown';
        const age = data.age || '--';
        
        let statusClass = 'status-Waiting';
        let statusText = 'Waiting';
        
        // Mock status based on severity for demonstration
        if (item.severity === 'Critical') {
            statusClass = 'status-InProgress';
            statusText = 'In Progress';
        } else if (item.waiting_time_sec > 600) {
            statusClass = 'status-InProgress';
            statusText = 'In Progress';
        }
        
        tr.innerHTML = `
            <td><strong>${item.patient_id}</strong></td>
            <td>${name}</td>
            <td>${age}</td>
            <td><span class="sev-badge sev-${item.severity}">${item.severity}</span></td>
            <td>${Math.floor(item.waiting_time_sec / 60)}m ${Math.floor(item.waiting_time_sec % 60)}s</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}


// ==========================================
// Admitted Patients Directory Logic
// ==========================================
let allPatients = [];

async function fetchPatients() {
    try {
        const res = await fetch(`${API_URL}/patients`);
        const data = await res.json();
        allPatients = data.patients;
        
        renderPatients();
        renderConsultedPatients();
        updateDashboardStats();
        updateReportsAnalytics(currentQueue);
    } catch (e) {
        console.error("Patients fetch error", e);
    }
}

function renderPatients() {
    const tbody = document.getElementById('patientsBody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    const searchInput = document.getElementById('searchId');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    
    const filtered = allPatients.filter(p => 
        p.patient_id.toLowerCase().includes(query) || 
        p.name.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:gray; padding: 2rem;">No matching patients found in directory.</td></tr>';
        return;
    }

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.patient_id}</strong></td>
            <td>${p.name}</td>
            <td>${p.age}</td>
            <td>${p.symptoms}</td>
            <td><span class="sev-badge sev-${p.severity}">${p.severity}</span></td>
            <td>${p.arrival_time}</td>
            <td><button class="delete-btn" onclick="deletePatient('${p.patient_id}')">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function deletePatient(patientId) {
    if (confirm("Are you sure you want to delete this patient?")) {
        fetch(`${API_URL}/delete_patient/${patientId}`, {
            method: "DELETE"
        })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            fetchPatients();
        })
        .catch(err => console.error(err));
    }
}

const searchInputEl = document.getElementById('searchId');
if(searchInputEl) searchInputEl.addEventListener('input', renderPatients);

const refreshDbBtnEl = document.getElementById('refreshDbBtn');
if(refreshDbBtnEl) refreshDbBtnEl.addEventListener('click', fetchPatients);

function formatDateTimeSafe(value) {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
}

function renderConsultedPatients() {
    const tbody = document.getElementById('consultedBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const searchEl = document.getElementById('consultedSearch');
    const query = searchEl ? searchEl.value.toLowerCase() : '';

    const consulted = allPatients
        .filter(p => String(p.status || '').toLowerCase() === 'completed')
        .filter(p => {
            const pid = String(p.patient_id || '').toLowerCase();
            const name = String(p.name || '').toLowerCase();
            return pid.includes(query) || name.includes(query);
        })
        .sort((a, b) => {
            const at = new Date(a.consultation_time || a.arrival_time || 0).getTime();
            const bt = new Date(b.consultation_time || b.arrival_time || 0).getTime();
            return bt - at;
        });

    if (consulted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:gray; padding: 2rem;">No consulted patients found.</td></tr>';
        return;
    }

    consulted.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.patient_id}</strong></td>
            <td>${p.name || 'Unknown'}</td>
            <td>${p.age ?? '--'}</td>
            <td><span class="sev-badge sev-${p.severity}">${p.severity}</span></td>
            <td>${p.symptoms || ''}</td>
            <td>${formatDateTimeSafe(p.consultation_time)}</td>
            <td><span class="status-badge status-Completed">Completed</span></td>
        `;
        tbody.appendChild(tr);
    });
}

const consultedSearchEl = document.getElementById('consultedSearch');
if (consultedSearchEl) consultedSearchEl.addEventListener('input', renderConsultedPatients);

const refreshConsultedBtnEl = document.getElementById('refreshConsultedBtn');
if (refreshConsultedBtnEl) refreshConsultedBtnEl.addEventListener('click', fetchPatients);


// ==========================================
// Dashboard Stats Update
// ==========================================
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function countPatientsAdmittedLast24Hours(patients) {
    const now = Date.now();
    return patients.filter(p => {
        if (!p.arrival_time) return false;
        const admissionMs = new Date(p.arrival_time).getTime();
        if (Number.isNaN(admissionMs)) return false;
        return (now - admissionMs) <= TWENTY_FOUR_HOURS_MS;
    }).length;
}

function updateDashboardStats() {
    const dashQueueCount = document.getElementById('dashQueueCount');
    const dashAdmittedCount = document.getElementById('dashAdmittedCount');
    const dashAdmittedTodayCount = document.getElementById('dashAdmittedTodayCount');
    
    if(dashQueueCount) dashQueueCount.innerText = `${currentQueue.length} Waiting`;
    if(dashAdmittedCount) dashAdmittedCount.innerText = `${allPatients.length} Admitted`;
    if(dashAdmittedTodayCount) {
        const todayCount = countPatientsAdmittedLast24Hours(allPatients);
        dashAdmittedTodayCount.innerText = `${todayCount} Admitted Today`;
    }
}


// ==========================================
// Chart.js Visualizations
// ==========================================
let sevChart, queueStatusChart, liveChart, repSevChart, lmChart;
const liveData = { labels: [], hr: [], o2: [] };
let timeCounter = 0;

function initCharts() {
    // 1. Severity Distribution (Doughnut)
    const ctxSev = document.getElementById('severityChart');
    if(ctxSev) {
        sevChart = new Chart(ctxSev.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Low', 'Medium', 'High', 'Critical'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } 
                },
                cutout: '70%'
            }
        });
    }
    
    // 2. Queue Status Chart (Bar)
    const ctxQueue = document.getElementById('queueStatusChart');
    if(ctxQueue) {
        queueStatusChart = new Chart(ctxQueue.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Low', 'Medium', 'High', 'Critical'],
                datasets: [{
                    label: 'Patients',
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
    
    // 3. Live Monitoring Chart (Line)
    const ctxLive = document.getElementById('liveMonitoringChart');
    if(ctxLive) {
        liveChart = new Chart(ctxLive.getContext('2d'), {
            type: 'line',
            data: {
                labels: liveData.labels,
                datasets: [
                    {
                        label: 'Heart Rate (bpm)',
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        data: liveData.hr,
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Oxygen Level (%)',
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        data: liveData.o2,
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 }, 
                plugins: { 
                    legend: { position: 'top', labels: { usePointStyle: true } } 
                },
                scales: {
                    y: {
                        min: 60,
                        max: 250,
                        grace: '5%'
                    },
                    x: { grid: { display: false }, display: false }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                }
            }
        });
    }
    
    // 4. Reports Severity Analytics (Doughnut)
    const ctxRepSev = document.getElementById('repSeverityChart');
    if(ctxRepSev) {
        repSevChart = new Chart(ctxRepSev.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Low', 'Medium', 'High', 'Critical'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { usePointStyle: true } } },
                cutout: '70%'
            }
        });
    }

    // 5. Dedicated Live Chart
    const ctxLm = document.getElementById('lmDedicatedChart');
    if(ctxLm) {
        lmChart = new Chart(ctxLm.getContext('2d'), {
            type: 'line',
            data: {
                labels: liveData.labels,
                datasets: [
                    {
                        label: 'Heart Rate (bpm)',
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        data: liveData.hr,
                        tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0
                    },
                    {
                        label: 'Oxygen Level (%)',
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        data: liveData.o2,
                        tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
                scales: { y: { min: 60, max: 120 }, x: { display: false } },
                plugins: { legend: { position: 'top' } }
            }
        });
    }
}

function updateCharts(queue) {
    if(!sevChart || !queueStatusChart) return;
    
    const counts = { 'Low': 0, 'Medium': 0, 'High': 0, 'Critical': 0 };
    queue.forEach(q => {
        if(counts[q.severity] !== undefined) {
            counts[q.severity]++;
        }
    });
    
    const dataArr = [counts['Low'], counts['Medium'], counts['High'], counts['Critical']];
    
    sevChart.data.datasets[0].data = dataArr;
    sevChart.update();
    
    queueStatusChart.data.datasets[0].data = dataArr;
    queueStatusChart.update();
    
    if(repSevChart) {
        repSevChart.data.datasets[0].data = dataArr;
        repSevChart.update();
    }
}

function updateLiveMonitoring() {
    if(!liveChart) return;
    
    timeCounter++;
    liveData.labels.push(timeCounter);
    
    // Dynamically derive base vitals from the most critical patient in the active queue
    let hrBase = 80;
    let o2Base = 98;
    if (currentQueue && currentQueue.length > 0) {
        const p = currentQueue[0];
        if (p.data && p.data.heart_rate) hrBase = parseFloat(p.data.heart_rate);
        if (p.data && p.data.oxygen) o2Base = parseFloat(p.data.oxygen);
    }
    
    // Add slight noise to simulate live sensor fluctuation around the real patient data
    const hrValue = hrBase + (Math.random() * 4 - 2);
    const o2Value = o2Base + (Math.random() * 2 - 1);
    
    liveData.hr.push(hrValue);
    liveData.o2.push(o2Value > 100 ? 100 : o2Value);
    
    // Keep max 30 points on chart
    if(liveData.labels.length > 30) {
        liveData.labels.shift();
        liveData.hr.shift();
        liveData.o2.shift();
    }
    
    liveChart.update();
    if(lmChart) lmChart.update();
    
    // Update Progress Bars and Values
    const lmHR = document.getElementById('lmHR');
    const lmO2 = document.getElementById('lmO2');
    const lmTemp = document.getElementById('lmTemp');
    const progHR = document.getElementById('progHR');
    const progO2 = document.getElementById('progO2');
    const progTemp = document.getElementById('progTemp');
    
    if (lmHR) lmHR.innerText = hrValue.toFixed(0);
    if (lmO2) lmO2.innerText = o2Value.toFixed(0);
    
    // Mock Temp
    let tempBase = 37.0;
    if (currentQueue && currentQueue.length > 0 && currentQueue[0].data && currentQueue[0].data.temperature) {
        tempBase = parseFloat(currentQueue[0].data.temperature);
    }
    const tempValue = tempBase + (Math.random() * 0.4 - 0.2);
    if (lmTemp) lmTemp.innerText = tempValue.toFixed(1);
    
    if (progHR) progHR.style.width = Math.min((hrValue / 150) * 100, 100) + "%";
    if (progO2) progO2.style.width = Math.min(o2Value, 100) + "%";
    if (progTemp) progTemp.style.width = Math.min((tempValue / 42) * 100, 100) + "%";
    
    // Mock Alert Generation
    if (o2Value < 85 && Math.random() < 0.1) {
        addCriticalAlert(`⚠ Oxygen dropped below safe threshold (${o2Value.toFixed(0)}%)`);
    }
    if (hrValue > 115 && Math.random() < 0.1) {
        addCriticalAlert(`⚠ Heart rate exceeded safe limit (${hrValue.toFixed(0)} bpm)`);
    }
}


// ==========================================
// Initial Load & Intervals
// ==========================================
fetchQueue();
fetchPatients();

// Refresh dashboard data every 5 seconds
setInterval(() => {
    fetchQueue();
    fetchPatients();
}, 5000);

// Update live chart every 2 seconds
setInterval(updateLiveMonitoring, 2000);

// ==========================================
// Reports & Analytics Logic
// ==========================================
function updateReportsAnalytics(queue) {
    const repTotalPatients = document.getElementById('repTotalPatients');
    if(!repTotalPatients) return; // fail gracefully if not in view
    repTotalPatients.innerText = queue.length + allPatients.length;
    document.getElementById('repCriticalCases').innerText = queue.filter(q => q.severity === 'Critical').length;
    
    let maxWait = 0;
    let totalWait = 0;
    queue.forEach(q => {
        if (q.waiting_time_sec > maxWait) maxWait = q.waiting_time_sec;
        totalWait += q.waiting_time_sec;
    });
    
    const avgWait = queue.length > 0 ? totalWait / queue.length : 0;
    document.getElementById('repAvgWait').innerText = `${Math.floor(avgWait / 60)}m`;
    document.getElementById('repLongestWait').innerText = `${Math.floor(maxWait / 60)}m ${Math.floor(maxWait % 60)}s`;
    
    document.getElementById('repTreated').innerText = allPatients.length;
    document.getElementById('repQueueLoad').innerText = queue.length > 0 ? Math.min(100, Math.floor((queue.length / 20) * 100)) + "%" : "0%";
    
    renderReportsHistory();
}

function renderReportsHistory() {
    const tbody = document.getElementById('repHistoryBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const searchEl = document.getElementById('repSearchId');
    const query = searchEl ? searchEl.value.toLowerCase() : '';
    const combined = [
        ...currentQueue.map(q => ({...q, status: 'Waiting'})),
        ...allPatients.map(p => ({...p, status: p.status || 'Admitted'}))
    ];
    
    const filtered = combined.filter(p => p.patient_id.toLowerCase().includes(query) || (p.data && p.data.name && p.data.name.toLowerCase().includes(query)) || (p.name && p.name.toLowerCase().includes(query)));
    
    filtered.forEach(item => {
        const tr = document.createElement('tr');
        const name = item.name || (item.data ? item.data.name : 'Unknown');
        const arrival = item.arrival_time || '--';
        const waitStr = item.waiting_time_sec ? `${Math.floor(item.waiting_time_sec / 60)}m` : '--';
        
        tr.innerHTML = `
            <td><strong>${item.patient_id}</strong></td>
            <td>${name}</td>
            <td><span class="sev-badge sev-${item.severity}">${item.severity}</span></td>
            <td>${waitStr}</td>
            <td>${item.status}</td>
            <td>${arrival}</td>
        `;
        tbody.appendChild(tr);
    });
}

const repSearchEl = document.getElementById('repSearchId');
if(repSearchEl) repSearchEl.addEventListener('input', renderReportsHistory);

const exportCsvBtn = document.getElementById('exportCsvBtn');
if(exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        let csvContent = "data:text/csv;charset=utf-8,Patient ID,Name,Severity,Status,Admission Time\n";
        const combined = [
            ...currentQueue.map(q => ({...q, status: 'Waiting'})),
            ...allPatients.map(p => ({...p, status: p.status || 'Admitted'}))
        ];
        
        combined.forEach(item => {
            const name = item.name || (item.data ? item.data.name : 'Unknown');
            const arrival = item.arrival_time || '--';
            csvContent += `${item.patient_id},${name},${item.severity},${item.status},${arrival}\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "patient_report.csv");
        document.body.appendChild(link);
        link.click();
    });
}

// ==========================================
// Live Monitoring Additions
// ==========================================
function renderMonitoringCards(queue) {
    const container = document.getElementById('lmPatientCards');
    if(!container) return;
    container.innerHTML = '';
    
    if (queue.length === 0) {
        container.innerHTML = '<div style="color: gray; padding: 1rem;">No patients in queue</div>';
        return;
    }
    
    queue.slice(0, 4).forEach(item => { // Show top 4
        const div = document.createElement('div');
        div.className = `lm-patient-card ${item.severity}`;
        const hr = item.data && item.data.heart_rate ? parseFloat(item.data.heart_rate).toFixed(0) : '--';
        const o2 = item.data && item.data.oxygen ? parseFloat(item.data.oxygen).toFixed(0) : '--';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <strong>${item.patient_id}</strong>
                <span class="sev-badge sev-${item.severity}">${item.severity}</span>
            </div>
            <div style="display: flex; gap: 15px; font-size: 0.9rem;">
                <div><span style="color: #64748b;">HR</span> <strong>${hr}</strong></div>
                <div><span style="color: #64748b;">SpO₂</span> <strong>${o2}%</strong></div>
                <div><span style="color: #64748b;">Status</span> <strong>Monitored</strong></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function addCriticalAlert(msg) {
    const feed = document.getElementById('lmAlertsFeed');
    if(!feed) return;
    const empty = feed.querySelector('.empty-alert');
    if(empty) empty.remove();
    
    const div = document.createElement('div');
    div.className = 'alert-item';
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    
    div.innerHTML = `
        ${msg}
        <span class="alert-time">${timeStr}</span>
    `;
    feed.insertBefore(div, feed.firstChild);
    
    if (feed.children.length > 15) {
        feed.removeChild(feed.lastChild);
    }
}

// ==========================================
// Profile Settings Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Toggles
    const prefCrit = document.getElementById('prefCritAlerts');
    const prefQueue = document.getElementById('prefQueueAlerts');
    const prefSys = document.getElementById('prefSysAlerts');
    
    if(prefCrit) prefCrit.checked = localStorage.getItem('prefCritAlerts') !== 'false';
    if(prefQueue) prefQueue.checked = localStorage.getItem('prefQueueAlerts') !== 'false';
    if(prefSys) prefSys.checked = localStorage.getItem('prefSysAlerts') !== 'false';
    
    const savePref = (e) => localStorage.setItem(e.target.id, e.target.checked);
    if(prefCrit) prefCrit.addEventListener('change', savePref);
    if(prefQueue) prefQueue.addEventListener('change', savePref);
    if(prefSys) prefSys.addEventListener('change', savePref);
    
    // Last login time
    const lastLog = document.getElementById('setLastLogin');
    if(lastLog) {
        lastLog.innerText = new Date().toLocaleString();
    }
    
    // Role matching
    const roleDisplay = document.getElementById('setRoleDisplay');
    if(roleDisplay) {
        roleDisplay.innerText = localStorage.getItem("userRole") || "Receptionist";
    }
    
    // Password form
    const pwdForm = document.getElementById('pwdForm');
    if(pwdForm) {
        pwdForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert("Password successfully updated.");
            pwdForm.reset();
        });
    }
});

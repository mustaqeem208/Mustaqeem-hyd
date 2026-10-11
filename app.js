// ==========================================
// 🚀 AUTO-LOGIN RECEIVER (Redirect Handle)
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const autoLoginPhone = urlParams.get('autoLogin');

if (autoLoginPhone) {
    localStorage.setItem("zigo_logged_phone", autoLoginPhone);
}
// ==========================================

const firebaseConfigRTDB = { apiKey: "AIzaSyCJpo25tYCN_fXP8aCckgA4WrD962KCsQ8", authDomain: "hyd-texi.firebaseapp.com", projectId: "hyd-texi", storageBucket: "hyd-texi.firebasestorage.app", messagingSenderId: "807048727786", appId: "1:807048727786:web:7ef03573876c70b76e1b93", databaseURL: "https://hyd-texi-default-rtdb.firebaseio.com" };
firebase.initializeApp(firebaseConfigRTDB); const dbRTDB = firebase.database();

let map, driverMarker, driverLat, driverLng, driverMobile;
let currentReqKey, currentReqData, routeLine, pickupMarker, dropMarker, reqVehicleMarker;
let followDriver = true, gpsWatchId = null, isRequesting = false, partnerObj = null, isOnline = false;
let requestQueue = []; let requestTimerInterval = null; let isAcceptEnabled = false; let isCurrentRideFake = false; let skippedRequests = {}; 
let autoFakeRideTimer = null;

const customDialog = document.getElementById('customDialog'), customDialogTitle = document.getElementById('customDialogTitle'), customDialogMessage = document.getElementById('customDialogMessage'), customDialogOk = document.getElementById('customDialogOk'), customDialogCancel = document.getElementById('customDialogCancel');
function showCustomConfirm(title, message, onOk, onCancel) { customDialogTitle.innerText = title || 'Confirm'; customDialogMessage.innerText = message || ''; customDialog.style.display = 'flex'; customDialogOk.style.display = 'inline-block'; customDialogCancel.style.display = 'inline-block'; function cleanup() { customDialog.style.display = 'none'; customDialogOk.removeEventListener('click', okHandler); customDialogCancel.removeEventListener('click', cancelHandler); } function okHandler() { cleanup(); if (onOk) onOk(); } function cancelHandler() { cleanup(); if (onCancel) onCancel(); } customDialogOk.addEventListener('click', okHandler); customDialogCancel.addEventListener('click', cancelHandler); }
function showCustomAlertDriver(title, message, onOk) { customDialogTitle.innerText = title || 'Alert'; customDialogMessage.innerText = message || ''; customDialog.style.display = 'flex'; customDialogCancel.style.display = 'none'; customDialogOk.style.display = 'inline-block'; function cleanup() { customDialog.style.display = 'none'; customDialogOk.removeEventListener('click', okHandler); } function okHandler() { cleanup(); if (onOk) onOk(); } customDialogOk.addEventListener('click', okHandler); }

function speak(text) { 
}

window.openProfileModal = function() {
    document.getElementById('menuBox').style.display = 'none'; 
    const isDemo = (driverMobile === "9999999999"); const data = window.zigoCurrentUser || partnerObj || {}; 
    document.getElementById('profName').innerText = isDemo ? "Review" : (data.name || "Partner");
    document.getElementById('profMobile').innerText = driverMobile || "---";
    document.getElementById('profType').innerText = data.vehicle || (partnerObj ? partnerObj.vehicleType : "Cab");
    document.getElementById('profVNo').innerText = isDemo ? "TS-09-DEMO" : (data.vNo || "Not Updated");
    document.getElementById('profDL').innerText = isDemo ? "DL-1234567890" : (data.dl || "Not Updated");
    
    const liveAvatar = document.getElementById('profLiveAvatarImg');
    const defaultIcon = document.getElementById('profDefaultAvatarIcon');
    if(liveAvatar && defaultIcon) {
        if(!isDemo && data.profileImageUrl) {
            liveAvatar.src = data.profileImageUrl;
            liveAvatar.classList.remove('hidden');
            defaultIcon.classList.add('hidden');
        } else {
            liveAvatar.classList.add('hidden');
            defaultIcon.classList.remove('hidden');
        }
    }

    const viewBtn = document.getElementById('driverDlLiveBtn');
    if(viewBtn) {
        const finalUrl = data.dlImageUrl || data.dlImage || partnerObj.dlImageUrl;
        if(!isDemo && finalUrl) {
            viewBtn.classList.remove('hidden');
            window.activeDriverDlUrlString = finalUrl; 
        } else {
            viewBtn.classList.add('hidden');
            window.activeDriverDlUrlString = null;
        }
    }

    if (isDemo) { document.getElementById('profExpiryContainer').style.display = 'none'; } else {
        document.getElementById('profExpiryContainer').style.display = 'flex';
        let expiryText = "N/A";
        if(data.recharge === "active") {
            expiryText = "Active / Valid";
            if(data.date) { 
                let d = new Date(data.date); 
                let planDays = data.validityDays ? Number(data.validityDays) : 28;
                if(!isNaN(d.getTime())) { 
                    d.setDate(d.getDate() + planDays); 
                    expiryText = d.toLocaleDateString(); 
                } 
            }
        } else { expiryText = "Expired"; }
        document.getElementById('profExpiry').innerText = expiryText;
    }
    document.getElementById('profileModal').style.display = 'flex';
};

window.viewDriverLiveDL = function() {
    if(window.activeDriverDlUrlString) {
        document.getElementById('driverModalLiveImg').src = window.activeDriverDlUrlString;
        document.getElementById('driverImageModal').style.display = 'flex';
    } else {
        showCustomAlertDriver('Error', 'Bhai, account me DL photo upload nahi hai.');
    }
};

window.closeDriverImageModal = function() { document.getElementById('driverImageModal').style.display = 'none'; };
window.closeProfileModal = function() { document.getElementById('profileModal').style.display = 'none'; };

function updateOfflineGreeting() {
    const hr = new Date().getHours(); let greet = "Good Evening"; if (hr < 12) greet = "Good Morning"; else if (hr < 17) greet = "Good Afternoon";
    document.getElementById('offlineGreeting').innerText = greet;
    document.getElementById('offlineDriverName').innerText = (driverMobile === "9999999999") ? "Review" : ((window.zigoCurrentUser || partnerObj || {}).name || "Partner");
}

async function updateLiveEarningsUI() {
    if (!driverMobile) return; const start = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime(); 
    try {
        const snap = await dbRTDB.ref('requests').orderByChild('driverMobile').equalTo(driverMobile).once('value'); 
        let total = 0; Object.values(snap.val() || {}).forEach(r=>{ if (r.status === 'completed' && r.completedAt && r.completedAt >= start) total += Number(r.price || 0); }); 
        document.getElementById('topEarningsDisplay').innerText = '₹' + total; document.getElementById('earnContent').innerText = '₹' + total; document.getElementById('menuEarnings').innerText = '₹' + total;
    } catch(e) {}
}

function getVehicleEmoji(type, isReq = false) { let emoji = '🚗'; if (type === 'auto') emoji = '🛺'; else if (type === 'bike') emoji = '🏍️'; if (isReq) return `<div class='request-icon-container'>${emoji}</div>`; return `<div class='driver-icon-container'>${emoji}</div>`; }
function updateDriverIcon() { if (!map) return; const vType = partnerObj && partnerObj.vehicleType ? partnerObj.vehicleType : 'car'; const carDivIcon = L.divIcon({ html: getVehicleEmoji(vType, false), className: '', iconSize: [56,56], iconAnchor: [28,56], popupAnchor: [0,-40] }); if (driverMarker) { driverMarker.setIcon(carDivIcon); driverMarker.getPopup().setContent(`Your ${vType.toUpperCase()} ${getVehicleEmoji(vType, false)}`); } }

window.openHelp = function(){ document.getElementById("helpModal").style.display="flex"; } 
window.closeHelp = function(){ document.getElementById("helpModal").style.display="none"; }

window.bootDriverApp = async (phone, adminVehicleSelected, partnerName) => {
    driverMobile = phone; updateOfflineGreeting(); updateLiveEarningsUI();
    let standardizedVehicle = 'car'; if(adminVehicleSelected) { let v = adminVehicleSelected.toLowerCase(); if(v.includes('bike')) standardizedVehicle = 'bike'; if(v.includes('auto')) standardizedVehicle = 'auto'; }
    partnerObj = { mobile: phone, vehicleType: standardizedVehicle, partnerId: 'P' + (Math.floor(100000 + Math.random()*900000)) };
    await dbRTDB.ref('partners/' + phone).update(partnerObj);
    initializeMap([17.3850, 78.4867], 13); startGPSCheck();
    if (!localStorage.getItem('zigo_verified_' + driverMobile)) { triggerFirstTimeVerification(driverMobile); } else { await loadPartnerProfile(phone); await recoverActiveRide(); }
};

let currentGeneratedOtp = "";
function triggerFirstTimeVerification(num) {
    currentGeneratedOtp = (num === "9999999999") ? "6655" : Math.floor(1000 + Math.random() * 9000).toString();
    const waNotify = document.getElementById('waNotify'); document.getElementById('waMsg').innerText = "ZIGO: Your 4-digit verification code is " + currentGeneratedOtp;
    waNotify.style.display = 'block'; document.getElementById('otpOverlay').style.display = 'flex';
    setTimeout(() => { document.getElementById('firstTimeOtp').value = currentGeneratedOtp; waNotify.style.display = 'none'; }, 2800);
}

window.verifyFirstTime = async () => {
    if (document.getElementById('firstTimeOtp').value === currentGeneratedOtp) {
        localStorage.setItem('zigo_verified_' + driverMobile, "true"); document.getElementById('otpOverlay').style.display = 'none'; 
        updateOfflineGreeting(); updateLiveEarningsUI(); await loadPartnerProfile(driverMobile); await recoverActiveRide();
    } else { showCustomAlertDriver('Error', 'OTP galat hai bhai!'); }
};

async function loadPartnerProfile(mobile) {
    try {
        const snap = await dbRTDB.ref('partners/' + mobile).once('value'); const data = snap.val();
        if (!data || !data.vehicleType || !data.partnerId) { partnerObj = data || {}; partnerObj.partnerId = partnerObj.partnerId || ('P' + (Math.floor(100000 + Math.random()*900000))); partnerObj.mobile = mobile; partnerObj.vehicleType = partnerObj.vehicleType || 'car'; await dbRTDB.ref('partners/' + mobile).update(partnerObj); updateDriverIcon(); } 
        else { partnerObj = data; updateDriverIcon(); isOnline = partnerObj.isOnline || false; }
        updateDutyUIState();
    } catch(err){ partnerObj = { partnerId: 'P' + (Math.floor(100000 + Math.random()*900000)), mobile: mobile, vehicleType: 'car' }; dbRTDB.ref('partners/' + mobile).set(partnerObj); updateDriverIcon(); updateDutyUIState(); }
}

function updateDutyUIState() {
    const knob = document.getElementById('dutySwitchKnob'), bg = document.getElementById('dutySwitchBg'), txt = document.getElementById('dutyStatusText'), box = document.getElementById('dutyToggleBox');
    const targetRecenterBtn = document.querySelector('.recenter-btn');
    
    if (isOnline) {
        txt.innerText = 'ON DUTY'; txt.className = 'text-[11px] font-black text-green-600 tracking-wider';
        bg.className = 'w-11 h-6 bg-green-500 rounded-full p-1 transition-colors duration-300 relative'; knob.className = 'w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 translate-x-5';
        box.className = 'flex items-center gap-3 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 shadow-sm cursor-pointer transition-all active:scale-95 duty-on-anim';
        document.getElementById('map').style.display = 'block'; document.getElementById('offlineView').style.display = 'none';
        
        if(targetRecenterBtn) { targetRecenterBtn.style.setProperty('display', 'flex', 'important'); }
        setTimeout(() => { if(map) map.invalidateSize(); }, 300);
    } else {
        txt.innerText = 'OFF DUTY'; txt.className = 'text-[11px] font-black text-gray-500 tracking-wider';
        bg.className = 'w-11 h-6 bg-gray-300 rounded-full p-1 transition-colors duration-300 relative'; knob.className = 'w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 translate-x-0';
        box.className = 'flex items-center gap-3 bg-white border border-gray-300 rounded-full px-4 py-1.5 shadow-sm cursor-pointer transition-all active:scale-95';
        document.getElementById('map').style.display = 'none'; document.getElementById('offlineView').style.display = 'flex';
        
        if(targetRecenterBtn) { targetRecenterBtn.style.setProperty('display', 'none', 'important'); }
        updateOfflineGreeting();
    }
}

window.toggleDuty = function() {
    if (!partnerObj || !partnerObj.vehicleType) { return openVehicleModal(); }
    isOnline = !isOnline;
    if (isOnline) { 
        dbRTDB.ref('partners/' + driverMobile + '/isOnline').set(true); updateDutyUIState(); startListening(); 
        
        if(window.playZigoAudio) window.playZigoAudio('audioOnline');
        
        startAutoFakeRideGenerator();

        if (driverMobile === "9999999999") { 
            setTimeout(() => { 
                if (isOnline && !isRequesting) { 
                    isCurrentRideFake = true; 
                    isRequesting = true; 
                    
                    try { 
                        let ring = document.getElementById('ringtone'); 
                        if(ring) { ring.loop = true; ring.currentTime = 0; ring.play().catch(()=>{}); } 
                    } catch(e){} 

                    showRequest({ pickupLat: driverLat + 0.005, pickupLng: driverLng + 0.005, dropLat: driverLat + 0.02, dropLng: driverLng + 0.02, price: 450, distance: "4 KM", customerMobile: "9876543210" }, "DEMO_REQ_" + Date.now(), "0.5", partnerObj.vehicleType || 'car', true); 
                } 
            }, 4000); 
        }
    } else { 
        dbRTDB.ref('partners/' + driverMobile + '/isOnline').set(false); updateDutyUIState(); stopListening(); if(isRequesting) skipRide(); 
        
        if(window.playZigoAudio) window.playZigoAudio('audioOffline');
        
        stopAutoFakeRideGenerator();
    }
}

function initializeMap(initialLatlng, initialZoom) {
    if (map) return;
    map = L.map('map', {zoomControl: false}).setView(initialLatlng, initialZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    driverMarker = L.marker(initialLatlng, {icon: L.divIcon({ html: getVehicleEmoji(partnerObj ? partnerObj.vehicleType : 'car', false), className: '', iconSize: [56,56], iconAnchor: [28,56], popupAnchor: [0,-40] }), draggable: true}).addTo(map).bindPopup("Your Vehicle");
    driverMarker.on('dragend', (e) => { const newLoc = driverMarker.getLatLng(); driverLat = newLoc.lat; driverLng = newLoc.lng; followDriver = false; if (driverMobile) dbRTDB.ref('partners/' + driverMobile + '/lastSeen').set({lat:driverLat,lng:driverLng,ts:Date.now()}); });
    map.on('dragstart', () => { followDriver = false; });
    driverLat = initialLatlng[0]; driverLng = initialLatlng[1];
}

function startGPSCheck() { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition((pos) => { driverLat = pos.coords.latitude; driverLng = pos.coords.longitude; if(driverMarker) driverMarker.setLatLng([driverLat,driverLng]); if(map) map.setView([driverLat,driverLng],16); if (!gpsWatchId) gpsWatchId = navigator.geolocation.watchPosition(onPositionUpdate, onGPSError, {enableHighAccuracy:true}); }, (err) => { if (!gpsWatchId) gpsWatchId = navigator.geolocation.watchPosition(onPositionUpdate, onGPSError, {enableHighAccuracy:true}); }, {enableHighAccuracy:true, timeout:5000}); }
function onPositionUpdate(pos) { driverLat = pos.coords.latitude; driverLng = pos.coords.longitude; if(driverMarker) driverMarker.setLatLng([driverLat, driverLng]); if(followDriver && map) map.panTo([driverLat, driverLng]); if (driverMobile) dbRTDB.ref('partners/' + driverMobile + '/lastSeen').set({lat:driverLat,lng:driverLng,ts:Date.now()}); }
function onGPSError(err) { followDriver = false; if (gpsWatchId) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; } }
window.recenterMap = function() { followDriver = true; if(driverLat && driverLng) { map.setView([driverLat, driverLng], map.getZoom() < 14 ? 16 : map.getZoom()); } }
window.openPickupMap = function() { if (!currentReqData || !driverLat || !driverLng) return showCustomAlertDriver('Error', 'Location data missing.'); window.open(`https://www.google.com/maps/dir/${driverLat},${driverLng}/${currentReqData.pickupLat},${currentReqData.pickupLng}/data=!4m2!4m1!3e0`, '_blank'); }
window.openDropMap = function() { if (!currentReqData || !currentReqData.dropLat || !currentReqData.dropLng) return showCustomAlertDriver('Error', 'Drop location missing.'); window.open(`https://www.google.com/maps/dir/${driverLat},${driverLng}/${currentReqData.dropLat},${currentReqData.dropLng}/data=!4m2!4m1!3e0`, '_blank'); }
window.callCustomer = function() { if (!currentReqData || !currentReqData.customerMobile) return showCustomAlertDriver('Error', 'Mobile number missing.'); window.location.href = `tel:${currentReqData.customerMobile}`; }

async function fetchAreaName(lat, lng, elementId, prefix="") {
    try { let res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`); let json = await res.json(); if (json && json.address) { document.getElementById(elementId).innerHTML = `<i class="fa ${elementId === 'reqPickupLoc' ? 'fa-circle-dot' : 'fa-location-dot'} mr-2"></i> ${prefix}${json.address.suburb || json.address.neighbourhood || json.address.city_district || json.address.town || "Customer Location"}`; } } catch(e) {}
}

function startRideRequestTimer() {
    clearInterval(requestTimerInterval); isAcceptEnabled = true; const btn = document.getElementById('acceptBtnUI'); const pBar = document.getElementById('reqTimerBar');
    btn.classList.add('active'); btn.innerText = "ACCEPT ✓"; 
    let totalTicks = 100;
    requestTimerInterval = setInterval(() => {
        totalTicks--; pBar.style.width = `${totalTicks}%`; pBar.style.background = totalTicks > 60 ? '#facc15' : totalTicks > 30 ? '#f59e0b' : '#ef4444';
        if (totalTicks <= 0) { clearInterval(requestTimerInterval); if (isRequesting) { skipRide(); } }
    }, 100);
}

function requestListener(snap) {
    if (!isOnline) return;
    if (skippedRequests[snap.key] && (Date.now() - skippedRequests[snap.key] < 7000)) return; 
    const data = snap.val(); if(!data || data.status !== "pending" || !driverLat || !driverLng) return;
    const reqVehicle = (data.vehicleType || 'car').toString().toLowerCase(), myVehicle = (partnerObj && partnerObj.vehicleType) ? partnerObj.vehicleType.toString().toLowerCase() : null;
    if (myVehicle && reqVehicle !== myVehicle) return; 
    let dist = getDist(driverLat, driverLng, data.pickupLat, data.pickupLng);
    if (dist <= 5.0) { requestQueue.push({ data: data, key: snap.key, pKM: dist.toFixed(1), reqVehicle: reqVehicle }); if (!isRequesting) { processNextRequest(); } }
}

function processNextRequest() {
    if (requestQueue.length === 0) { isRequesting = false; return; }
    isRequesting = true; let nextReq = requestQueue.shift();
    
    try { 
        let ring = document.getElementById('ringtone'); 
        if(ring) { 
            ring.loop = true; 
            ring.currentTime = 0; 
            ring.play().catch(()=>{}); 
        } 
    } catch(e){}
    
    showRequest(nextReq.data, nextReq.key, nextReq.pKM, nextReq.reqVehicle);
}

function startListening() { if(!isOnline) return; dbRTDB.ref('requests').limitToLast(10).on('child_added', requestListener); dbRTDB.ref('requests').limitToLast(10).on('child_changed', requestListener); }
function stopListening() { dbRTDB.ref('requests').limitToLast(10).off('child_added', requestListener); dbRTDB.ref('requests').limitToLast(10).off('child_changed', requestListener); requestQueue = []; }

function showRequest(data, key, pKM, reqVehicle, isFake = false) {
    currentReqKey = key; currentReqData = data;
    document.getElementById('reqVehicleIcon').innerText = reqVehicle === 'auto' ? '🛺' : reqVehicle === 'bike' ? '🏍️' : '🚗';
    const titleEl = document.getElementById('reqPopupTitle');
    if (isFake) { titleEl.innerText = "🚨 DEMO RIDE REQUEST 🚨"; titleEl.style.color = "#ef4444"; titleEl.style.textShadow = "0 0 15px rgba(239,68,68,0.4)"; } 
    else { titleEl.innerText = "NEW RIDE REQUEST 🔔"; titleEl.style.color = "#facc15"; titleEl.style.textShadow = "0 0 15px rgba(250,204,21,0.6)"; }
    document.getElementById('fareDisplay').innerText = data.price || 0; document.getElementById('pickupDist').innerText = pKM + " KM"; document.getElementById('tripDist').innerText = data.distance || '--';
    let prefix = isFake ? "[DEMO] " : "";
    document.getElementById('reqPickupLoc').innerHTML = `<i class="fa fa-circle-dot loc-icon" style="color:#2ecc71;"></i><div class="loc-text">${prefix}Fetching Location...</div>`;
    document.getElementById('reqDropLoc').innerHTML = `<i class="fa fa-location-dot loc-icon" style="color:#e74c3c;"></i><div class="loc-text">${prefix}Fetching Location...</div>`;
    if (data.pickupLocationName) document.getElementById('reqPickupLoc').innerHTML = `<i class="fa fa-circle-dot loc-icon" style="color:#2ecc71;"></i><div class="loc-text">${prefix}${data.pickupLocationName}</div>`; else fetchAreaName(data.pickupLat, data.pickupLng, 'reqPickupLoc', prefix);
    if (data.dropLocationName) document.getElementById('reqDropLoc').innerHTML = `<i class="fa fa-location-dot loc-icon" style="color:#e74c3c;"></i><div class="loc-text">${prefix}${data.dropLocationName}</div>`; else if (data.dropLat) fetchAreaName(data.dropLat, data.dropLng, 'reqDropLoc', prefix);
    if (reqVehicleMarker) map.removeLayer(reqVehicleMarker);
    reqVehicleMarker = L.marker([data.pickupLat, data.pickupLng], {icon: L.divIcon({ html: getVehicleEmoji(reqVehicle, true), className: '', iconSize: [50,50], iconAnchor: [25,50], popupAnchor: [0,-30] })}).addTo(map);
    if (pickupMarker) map.removeLayer(pickupMarker); pickupMarker = reqVehicleMarker; 
    if(isOnline) map.setView([data.pickupLat, data.pickupLng], 15); document.getElementById('reqPopup').style.display = 'block'; startRideRequestTimer(); 
}

window.tryAcceptRide = function() {
    if (!isAcceptEnabled) return; clearInterval(requestTimerInterval); 
    
    try { let ring = document.getElementById('ringtone'); if (ring) { ring.pause(); ring.currentTime = 0; } } catch(e){} 
    
    requestQueue = []; 

    if (currentReqData && currentReqData.customerMobile === "AUTO_FAKE_MISS") {
        showCustomAlertDriver('Booking Missed', 'Booking missed by another driver or customer cancelled.');
        resetUIForNextRide();
        return;
    }

    if (isCurrentRideFake) {
        document.getElementById('reqPopup').style.display = 'none'; document.getElementById('pickupCard').style.display = 'none'; document.getElementById('dropCard').style.display = 'block';
        if (pickupMarker) map.removeLayer(pickupMarker); if (reqVehicleMarker) map.removeLayer(reqVehicleMarker);
        driverLat = currentReqData.pickupLat; driverLng = currentReqData.pickupLng; drawRoute(driverLat, driverLng, currentReqData.dropLat, currentReqData.dropLng, '#2ecc71');
        dropMarker = L.marker([currentReqData.dropLat, currentReqData.dropLng], {icon: L.icon({iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [25, 41]})}).addTo(map).bindPopup("DROP");
        isRequesting = false; return;
    }
    
    stopListening(); 
    if (!partnerObj || !partnerObj.vehicleType) { partnerObj = partnerObj || { vehicleType: null }; openVehicleModal(); if(isOnline) startListening(); isRequesting = false; return; }
    dbRTDB.ref('requests/' + currentReqKey).transaction(function(curr) {
        if (curr === null) return curr;
        if (curr.status === 'pending') { return { ...curr, status: 'accepted', driverMobile: driverMobile, driverVehicle: partnerObj.vehicleType || 'unknown', driverId: partnerObj.partnerId || driverMobile, acceptedAt: Date.now() }; } else return;
    }, function(error, committed, snapshot) {
        if (!committed) { showCustomAlertDriver('Booking Missed', 'Booking missed by another driver or customer cancelled.'); resetUIForNextRide(); } 
        else {
            currentReqData = snapshot.val();
            dbRTDB.ref('partners/' + driverMobile + '/history').push({ reqId: currentReqKey, price: currentReqData.price || 0, status: 'accepted', ts: Date.now() });
            if (!partnerObj || !partnerObj.partnerId) { const pid = 'P' + (Math.floor(100000 + Math.random()*900000)); partnerObj = partnerObj || {}; partnerObj.partnerId = pid; partnerObj.mobile = driverMobile; partnerObj.vehicleType = partnerObj.vehicleType || 'car'; dbRTDB.ref('partners/' + driverMobile).set(partnerObj); }
            rideSecured();
        }
    });
}

function rideSecured() { 
    document.getElementById('reqPopup').style.display = 'none'; document.getElementById('pickupCard').style.display = 'block'; document.getElementById('custMobDisp').innerText = currentReqData.customerMobile || '--'; 
    drawRoute(driverLat, driverLng, currentReqData.pickupLat, currentReqData.pickupLng, '#d4af37'); 
    
    dbRTDB.ref('requests/' + currentReqKey).on('value', (snap) => {
        const data = snap.val();
        if (data && data.status === 'cancelled' && data.cancelledBy === 'customer') { 
            showCustomAlertDriver("Ride Cancelled 🚫", "Customer ne ride cancel kar di hai."); 
            if(window.playZigoAudio) window.playZigoAudio('audioCancel');
            resetUIForNextRide(); 
        }
    });
}

window.verifyOtp = function() {
    const entered = document.getElementById('otpIn').value; if (!currentReqData) return;
    if (entered === (currentReqData.otp || '').toString() && entered.length > 0) { 
        try { dbRTDB.ref('requests/' + currentReqKey).update({ status: "started", startedAt: Date.now() }); } catch(e) {}
        document.getElementById('pickupCard').style.display = 'none'; document.getElementById('dropCard').style.display = 'block';
        if (pickupMarker) map.removeLayer(pickupMarker); if (reqVehicleMarker) map.removeLayer(reqVehicleMarker); 
        if (currentReqData.dropLat && currentReqData.dropLng) {
            driverLat = currentReqData.pickupLat; driverLng = currentReqData.pickupLng; drawRoute(driverLat, driverLng, currentReqData.dropLat, currentReqData.dropLng, '#2ecc71');
            if (dropMarker) map.removeLayer(dropMarker); dropMarker = L.marker([currentReqData.dropLat, currentReqData.dropLng], {icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [25, 41] })}).addTo(map).bindPopup("DROP"); document.getElementById('mapNavBtnDrop').style.display = 'block';
        } else { showCustomAlertDriver('Drop Missing', 'Drop coordinates not available.'); document.getElementById('mapNavBtnDrop').style.display = 'none'; }
    } else { showCustomAlertDriver('Wrong OTP', 'The OTP entered is incorrect.'); }
}

window.completeRide = function() {
    if (!currentReqKey || !currentReqData) return;
    document.getElementById('dropCard').style.display = 'none'; document.getElementById('billModal').style.display = 'flex'; document.getElementById('billAmount').innerText = "₹" + (currentReqData.price || 0); 
    if (!isCurrentRideFake) { dbRTDB.ref('requests/' + currentReqKey).update({ status: "completed", completedAt: Date.now() }); if (driverMobile) dbRTDB.ref('partners/' + driverMobile + '/history').push({ reqId: currentReqKey, price: currentReqData.price || 0, status: 'completed', ts: Date.now() }); }
    updateLiveEarningsUI(); 
}

window.closeBillAndNext = function() { document.getElementById('billModal').style.display = 'none'; resetUIForNextRide(); }
window.skipRide = function() { 
    clearInterval(requestTimerInterval); 
    try { let ring = document.getElementById('ringtone'); if (ring) { ring.pause(); ring.currentTime = 0; } } catch(e) {} 
    
    if (currentReqKey) skippedRequests[currentReqKey] = Date.now(); 
    resetUIForNextRide(); 
}
window.cancelRide = function() { showCustomConfirm('Cancel Ride', 'Are you sure you want to cancel this ride?', function ok() { if (!currentReqKey) { showCustomAlertDriver('No ride', 'No active ride to cancel.'); return; } if (isCurrentRideFake) { resetUIForNextRide(); return; } dbRTDB.ref('requests/' + currentReqKey).update({ status: "cancelled", cancelledBy: "driver" }).then(()=> { resetUIForNextRide(); }).catch((err)=> { showCustomAlertDriver('Error','Cancel failed'); }); }, function cancel(){}); }

function resetUIForNextRide() {
    if (currentReqKey && !isCurrentRideFake) dbRTDB.ref('requests/' + currentReqKey).off(); 
    document.getElementById('reqPopup').style.display = 'none'; document.getElementById('pickupCard').style.display = 'none'; document.getElementById('dropCard').style.display = 'none';
    if (pickupMarker) { map.removeLayer(pickupMarker); pickupMarker = null; } if (reqVehicleMarker) { map.removeLayer(reqVehicleMarker); reqVehicleMarker = null; } if (dropMarker) { map.removeLayer(dropMarker); dropMarker = null; } if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    isRequesting = false; isCurrentRideFake = false; currentReqKey = null; currentReqData = null;
    if (isOnline) { startListening(); processNextRequest(); }
}

function drawRoute(lat1, lng1, lat2, lng2, color) { if(routeLine) map.removeLayer(routeLine); routeLine = L.polyline([[lat1, lng1], [lat2, lng2]], { color: color, weight: 5, className: 'route-animated' }).addTo(map); map.fitBounds(routeLine.getBounds(), {padding:[40,40]}); }
function getDist(lat1,lon1,lat2,lon2) { var R = 6371; var dLat = (lat2-lat1)*(Math.PI/180); var dLon = (lon2-lon1)*(Math.PI/180); var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180)) * Math.cos(lat2*(Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); }

async function recoverActiveRide() {
    if (!driverMobile) return; const snap = await dbRTDB.ref('requests').orderByChild('driverMobile').equalTo(driverMobile).once('value'); const data = snap.val();
    if(data) {
        for (let key in data) {
            let ride = data[key];
            if (ride.status === 'accepted' || ride.status === 'started') {
                currentReqKey = key; currentReqData = ride; isRequesting = true; document.getElementById('reqPopup').style.display = 'none';
                if (ride.status === 'accepted') {
                    document.getElementById('pickupCard').style.display = 'block'; document.getElementById('custMobDisp').innerText = ride.customerMobile || '--';
                    if(!driverLat) driverLat = ride.pickupLat; if(!driverLng) driverLng = ride.pickupLng; drawRoute(driverLat, driverLng, ride.pickupLat, ride.pickupLng, '#d4af37');
                } else if (ride.status === 'started') {
                    document.getElementById('pickupCard').style.display = 'none'; document.getElementById('dropCard').style.display = 'block';
                    if(!driverLat) driverLat = ride.pickupLat; if(!driverLng) driverLng = ride.pickupLng; drawRoute(driverLat, driverLng, ride.dropLat, ride.dropLng, '#2ecc71');
                }
                
                dbRTDB.ref('requests/' + currentReqKey).on('value', (s) => { 
                    const rd = s.val(); 
                    if (rd && rd.status === 'cancelled' && rd.cancelledBy === 'customer') { 
                        showCustomAlertDriver("Ride Cancelled 🚫", "Customer ne ride cancel kar di hai."); 
                        if(window.playZigoAudio) window.playZigoAudio('audioCancel');
                        resetUIForNextRide(); 
                    } 
                }); break;
            }
        }
    }
}

window.toggleMenu = function(){ const m = document.getElementById('menuBox'); m.style.display = (m.style.display==='block') ? 'none':'block'; }
window.openVehicleModal = function(){ document.getElementById('vehicleModal').style.display='flex'; document.getElementById('menuBox').style.display = 'none'; }
window.closeVehicleModal = function(){ document.getElementById('vehicleModal').style.display='none'; }
window.chooseVehicle = function(v){ 
    partnerObj = partnerObj || {}; partnerObj.vehicleType = v; partnerObj.mobile = driverMobile; partnerObj.partnerId = partnerObj.partnerId || ('P' + (Math.floor(100000 + Math.random()*900000))); 
    if(document.getElementById('profType')) document.getElementById('profType').innerText = v.toUpperCase();
    dbRTDB.ref('partners/' + driverMobile).update({ vehicleType: v, partnerId: partnerObj.partnerId, mobile: driverMobile, updatedAt: Date.now() }).then(()=>{ showCustomAlertDriver('Saved', 'Vehicle set to ' + v.toUpperCase()); updateDriverIcon(); closeVehicleModal(); }); 
}
window.openVehicleChange = function(){ openVehicleModal(); }
window.showTodayEarnings = function(){ document.getElementById('menuBox').style.display = 'none'; if (!driverMobile) return showCustomAlertDriver('Login', 'Please login first.'); document.getElementById('earnModal').style.display = 'flex'; }
window.closeEarnModal = function(){ document.getElementById('earnModal').style.display='none'; }

window.showPartnerHistory = async function(){ 
    document.getElementById('menuBox').style.display = 'none'; 
    if (!driverMobile) return showCustomAlertDriver('Login', 'Please login first.'); 
    
    const snap = await dbRTDB.ref('requests').orderByChild('driverMobile').equalTo(driverMobile).limitToLast(100).once('value'); 
    const listDom = document.getElementById('histList'); 
    listDom.innerHTML = ''; 
    
    let count24 = 0;
    let count48 = 0;
    const timeLimit48Hrs = Date.now() - (48 * 60 * 60 * 1000); 
    const timeLimit24Hrs = Date.now() - (24 * 60 * 60 * 1000);

    const items = Object.keys(snap.val() || {}).map(k=>({id:k, val:(snap.val() || {})[k]})).sort((a,b)=> (b.val.timestamp||b.val.completedAt||0) - (a.val.timestamp||a.val.completedAt||0)); 
    
    if (items.length===0) {
        listDom.innerHTML = '<div style="padding:12px;color:#aaa">No rides yet</div>'; 
    } else {
        items.forEach(it=>{ 
            const v = it.val; 
            const reqTime = v.completedAt || v.timestamp || v.acceptedAt || 0;
            
            if (v.status === 'completed' && reqTime >= timeLimit48Hrs) {
                count48++;
                if (reqTime >= timeLimit24Hrs) {
                    count24++;
                }
            }

            const statusColor = v.status === 'completed' ? '#2ecc71' : (v.status === 'cancelled' ? '#e74c3c' : '#facc15');
            const row = document.createElement('div'); row.className='hist-row'; 
            
            row.innerHTML = `
            <div style="flex:1; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:900; color:#fff; font-size:1.1rem;">₹${v.price||0} <span style="font-size:0.8rem; color:#888; font-weight:normal;">• ${v.vehicleType?v.vehicleType.toUpperCase():''}</span></div>
                    <div style="color:${statusColor}; font-size:0.75rem; font-weight:bold; text-transform:uppercase; margin-top:2px;">${v.status||'--'}</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:0.75rem; color:#999; font-weight:bold;">${reqTime ? new Date(reqTime).toLocaleDateString() : '--'}</div>
                    <div style="font-size:0.65rem; color:#777;">${reqTime ? new Date(reqTime).toLocaleTimeString() : '--'}</div>
                </div>
            </div>`; 
            listDom.appendChild(row); 
        }); 
    }
    
    document.getElementById('driverStats24').innerText = count24;
    document.getElementById('driverStats48').innerText = count48;
    
    document.getElementById('histModal').style.display = 'flex'; 
}

window.closeHistModal = function(){ document.getElementById('histModal').style.display='none'; }
window.logoutAndClear = function(){ document.getElementById('menuBox').style.display = 'none'; showCustomConfirm('Logout', 'Clear saved mobile and logout?', function ok(){ window.logout(); }, function cancel(){}); }
window.addEventListener('beforeunload', ()=> { if (driverMobile) dbRTDB.ref('partners/' + driverMobile + '/isOnline').set(false); stopListening(); });

window.changeAppLanguage = function(langKey) {
    const translationPack = {
        en: { sub: "Professional Partner Portal", auth: "Authorized Access", signin: "Sign In Dashboard", launch: "Launch Dashboard", np: "New Partner", fp: "Forgot Password?", todayRev: "Today's Revenue", view: "View", duty: "Toggle ON DUTY to map", perf: "Best Performance", accept: "100% Acceptance", qaTitle: "Quick Actions", qaEarn: "Earnings", qaProf: "Profile", qaVeh: "Vehicle", qaOrd: "Orders", menuProf: "My Profile", menuEarn: "Earnings", menuHist: "Ride History", menuVeh: "Change Vehicle", menuLog: "Logout (Clear)", menuDel: "Delete Account" },
        te: { sub: "ప్రొఫెషనల్ పార్ట్నర్ పోర్టల్", auth: "అధికారిక లాగిన్", signin: "సైన్ ఇన్ డాష్‌బోర్డ్", launch: "యాప్‌ను ప్రారంభించండి", np: "కొత్త భాగస్వామి", fp: "పాస్‌వర్డ్ మర్చిపోయారా?", todayRev: "ఈరోజు సంపాదన", view: "చూడండి", duty: "మ్యాప్ కోసం ఆన్ డ్యూటీ చేయండి", perf: "ఉత్తమ ప్రదర్శన", accept: "100% అంగీకారం", qaTitle: "త్వరిత చర్యలు", qaEarn: "సంపాదన", qaProf: "ప్రొఫైల్", qaVeh: "వాహనం", qaOrd: "ఆర్డర్లు", menuProf: "నా ప్రొఫైల్", menuEarn: "ఆదాయం", menuHist: "రైడ్ చరిత్ర", menuVeh: "వాహనం మార్చండి", menuLog: "లాగ్ అవుట్", menuDel: "ఖాతాను తొలగించండి" },
        hi: { sub: "प्रोफेशनल पार्टनर पोर्टल", auth: "अधिकृत प्रवेश", signin: "साइन इन डैशबोर्ड", launch: "डैशबोर्ड लॉन्च करें", np: "नया पार्टनर", fp: "पासवर्ड भूल गए?", todayRev: "आज की कमाई", view: "देखें", duty: "मैप के लिए ऑन ड्यूटी करें", perf: "सर्वश्रेष्ठ प्रदर्शन", accept: "100% स्वीकृति", qaTitle: "त्वरित विकल्प", qaEarn: "कमाई", qaProf: "प्रोफ़ाइल", qaVeh: "वाहन", qaOrd: "ऑर्डर", menuProf: "मेरी प्रोफ़ाइल", menuEarn: "कमाई", menuHist: "राइड इतिहास", menuVeh: "वाहन बदलें", menuLog: "लॉगआउट करें", menuDel: "अकाउंट डिलीट करें" },
        ur: { sub: "پروفیشنل پارٹنر پورٹل", auth: "مجاز رسائی", signin: "سائن ان ڈیش بورڈ", launch: "ڈیش بورڈ شروع کریں", np: "نیا پارٹنر", fp: "پاس ورڈ بھول گئے؟", todayRev: "آج کی آمدنی", view: "دیکھیں", duty: "میپ کیلئے آن ڈیوٹی کریں", perf: "بہترین کارکردگی", accept: "100% متبادل", qaTitle: "فوری ایکشنز", qaEarn: "آمدنی", qaProf: "پروفائل", qaVeh: "گاڑی", qaOrd: "آرڈرز", menuProf: "میری پروفائل", menuEarn: "آمدنی", menuHist: "رائڈ ہسٹری", menuVeh: "گاڑی تبدیل کریں", menuLog: "لاگ آؤٹ", menuDel: "اکاؤنٹ حذف کریں" }
    };
    const pack = translationPack[langKey] || translationPack.en;
    
    const updateTxt = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
    const updateHtml = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html; };
    
    updateTxt("langSubLogo", pack.sub);
    updateHtml("langAuthAccess", `<i class="fa fa-lock mr-1"></i> ` + pack.auth);
    updateTxt("langSignInTitle", pack.signin);
    updateTxt("langLaunchBtn", pack.launch);
    updateHtml("langNewPartner", `<i class="fa fa-user-plus mr-1"></i> ` + pack.np);
    updateTxt("langForgotPass", pack.fp);
    updateTxt("langTodayRevenue", pack.todayRev);
    updateTxt("langViewText", pack.view);
    updateHtml("langToggleDutyTag", `<i class="fa fa-power-off mr-1"></i> ` + pack.duty);
    updateTxt("langPerfTag", pack.perf);
    updateTxt("langAcceptTag", pack.accept);
    updateTxt("langQuickActions", pack.qaTitle);
    updateTxt("langQaEarnings", pack.qaEarn);
    updateTxt("langQaProfile", pack.qaProf);
    updateTxt("langQaVehicle", pack.qaVeh);
    updateTxt("langQaOrders", pack.qaOrd);
    updateHtml("langMenuProfile", `<i class="fa fa-user-circle"></i> ` + pack.menuProf);
    updateHtml("langMenuEarnings", `<i class="fa fa-wallet"></i> ` + pack.menuEarn + ` <span id="menuEarnings" style="margin-left:auto; color:#2ecc71; font-weight:900;">₹0</span>`);
    updateHtml("langMenuHistory", `<i class="fa fa-clock-rotate-left"></i> ` + pack.menuHist);
    updateHtml("langMenuVehicle", `<i class="fa fa-car"></i> ` + pack.menuVeh);
    updateHtml("langMenuLogout", `<i class="fa fa-power-off"></i> ` + pack.menuLog);
    updateHtml("langMenuDeleteAccount", `<i class="fa fa-user-minus text-red-500"></i> ` + pack.menuDel);
    
    updateLiveEarningsUI();
};

window.openGuideVideo = function() {
    const videoUrl = "https://www.youtube.com/embed/wMPU-Z33Dk8?autoplay=1"; 
    document.getElementById('guideVideoIframe').src = videoUrl;
    document.getElementById('videoGuideModal').style.display = 'flex';
};

window.closeGuideVideo = function() {
    document.getElementById('guideVideoIframe').src = ""; 
    document.getElementById('videoGuideModal').style.display = 'none';
};

function startAutoFakeRideGenerator() {
    stopAutoFakeRideGenerator(); 

    let today = new Date().toDateString();
    let lastFakeRideDate = localStorage.getItem("zigo_last_fake_ride_date_" + driverMobile);
    
    if (lastFakeRideDate === today) {
        return; 
    }

    let randomDelay = Math.floor(Math.random() * (1200000 - 180000 + 1)) + 180000;
    
    autoFakeRideTimer = setTimeout(() => {
        if (isOnline && !isRequesting) {
            let vType = partnerObj && partnerObj.vehicleType ? partnerObj.vehicleType.toLowerCase() : 'car';
            let ratePerKm = 35; let minFare = 250;
            if (vType === 'auto') { ratePerKm = 20; minFare = 140; } 
            else if (vType === 'bike') { ratePerKm = 16; minFare = 90; } 
            
            let genDist = (Math.random() * (8 - 2) + 2);
            let finalDistanceText = genDist.toFixed(1) + " KM";
            
            let calculatedPrice = Math.round(genDist * ratePerKm);
            if (calculatedPrice < minFare) {
                calculatedPrice = minFare;
            }

            let fakeReqData = {
                pickupLat: driverLat + (Math.random() * 0.02 - 0.01),
                pickupLng: driverLng + (Math.random() * 0.02 - 0.01),
                dropLat: driverLat + (Math.random() * 0.05 - 0.025),
                dropLng: driverLng + (Math.random() * 0.05 - 0.025),
                price: calculatedPrice, 
                distance: finalDistanceText,
                customerMobile: "AUTO_FAKE_MISS" 
            };
            
            isRequesting = true;
            try { let ring = document.getElementById('ringtone'); if(ring) { ring.loop = true; ring.currentTime = 0; ring.play().catch(()=>{}); } } catch(e){}
            
            showRequest(fakeReqData, "AUTO_FAKE_" + Date.now(), (Math.random() * 3 + 0.5).toFixed(1), vType, false);
            
            localStorage.setItem("zigo_last_fake_ride_date_" + driverMobile, today);
        }
    }, randomDelay);
}

function stopAutoFakeRideGenerator() {
    if (autoFakeRideTimer) { clearTimeout(autoFakeRideTimer); autoFakeRideTimer = null; }
}

window.openFullWebPage = function(url) {
    const iframe = document.getElementById('fullWebIframe');
    const modal = document.getElementById('fullWebModal');
    let finalUrl = url;
    if (!/^https?:\/\//i.test(url)) { finalUrl = 'https://' + url; }

    iframe.src = finalUrl;
    modal.style.display = 'flex';
};

window.closeFullWebPage = function() {
    document.getElementById('fullWebIframe').src = ""; 
    document.getElementById('fullWebModal').style.display = 'none';
};


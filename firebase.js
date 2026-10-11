import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDly054G2K-3NcXeLguGwzbXeBCh3a1IVA",
    authDomain: "zigopartner2.firebaseapp.com",
    databaseURL: "https://zigopartner2-default-rtdb.firebaseio.com",
    projectId: "zigopartner2",
    storageBucket: "zigopartner2.firebasestorage.app",
    messagingSenderId: "46628836745",
    appId: "1:46628836745:web:20c917d5d9cc558e647d58",
    measurementId: "G-TMHKT2JEVC"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let isAppUpdateActive = false;
let imageTimeoutTracker = null;
window.zigoCurrentUser = null;

// ==========================================
// 🚀 DYNAMIC RECHARGE PLAN STATE (19, 49, 99)
// ==========================================
window.selectedPlan = {
    amount: 99,
    validityDays: 28,
    title: "28 Days Platform Access"
};

window.selectRechargePlan = function(amount, days, title) {
    let numAmount = Number(amount) || 99;
    let finalDays = Number(days) || 28;
    
    if (numAmount === 19) finalDays = 1;
    else if (numAmount === 49) finalDays = 10;
    else finalDays = 28;

    let finalTitle = title || (numAmount === 19 ? "24 Hours Platform Access" : (numAmount === 49 ? "10 Days Platform Access" : "28 Days Platform Access"));

    window.selectedPlan = { amount: numAmount, validityDays: finalDays, title: finalTitle };
    
    // Save to localStorage so browser never defaults back to 99
    localStorage.setItem("zigo_selected_plan_amt", numAmount.toString());
    localStorage.setItem("zigo_selected_plan_days", finalDays.toString());

    // Reset all plan cards
    [19, 49, 99].forEach(p => {
        const card = document.getElementById('planCard' + p);
        if (card) {
            card.className = "recharge-plan-card p-4 rounded-2xl border border-white/10 bg-black/40 cursor-pointer transition-all hover:border-yellow-400/50 flex items-center justify-between";
            const dot = card.querySelector('.plan-radio-dot');
            const radio = card.querySelector('.plan-radio');
            if(dot) dot.className = "plan-radio-dot w-2.5 h-2.5 rounded-full bg-transparent";
            if(radio) radio.className = "plan-radio w-5 h-5 rounded-full border-2 border-gray-500 flex items-center justify-center";
        }
    });

    // Set active selected card
    const activeCard = document.getElementById('planCard' + numAmount);
    if (activeCard) {
        activeCard.className = "recharge-plan-card p-4 rounded-2xl border-2 border-yellow-400 bg-yellow-400/10 cursor-pointer transition-all flex items-center justify-between shadow-[0_0_20px_rgba(250,204,21,0.15)] relative overflow-hidden";
        const activeDot = activeCard.querySelector('.plan-radio-dot');
        const activeRadio = activeCard.querySelector('.plan-radio');
        if(activeDot) activeDot.className = "plan-radio-dot w-2.5 h-2.5 rounded-full bg-yellow-400";
        if(activeRadio) activeRadio.className = "plan-radio w-5 h-5 rounded-full border-2 border-yellow-400 flex items-center justify-center";
    }

    // Update Pay Button
    const payBtn = document.getElementById('rechargePayButton');
    if (payBtn) {
        payBtn.innerHTML = `<i class="fa fa-bolt text-black text-sm"></i> Pay ₹${numAmount} & Activate ID`;
    }
};

window.startRazorpayPayment = async () => {
    const phone = localStorage.getItem("zigo_logged_phone");
    if (!phone) return window.showPortalAlert("Please login to pay!", false);

    // Read exact plan from selected state or saved storage
    const savedAmt = Number(localStorage.getItem("zigo_selected_plan_amt")) || window.selectedPlan?.amount || 99;
    const savedDays = Number(localStorage.getItem("zigo_selected_plan_days")) || window.selectedPlan?.validityDays || (savedAmt === 19 ? 1 : (savedAmt === 49 ? 10 : 28));
    
    const currentPlan = {
        amount: savedAmt,
        validityDays: savedDays,
        title: savedAmt === 19 ? "24 Hours Platform Access" : (savedAmt === 49 ? "10 Days Platform Access" : "28 Days Platform Access")
    };

    const amountInPaise = (currentPlan.amount * 100).toString();

    // REVIEWER BYPASS
    if (phone === "9999999999") {
        localStorage.setItem("zigo_demo_paid", "true");
        window.showPortalAlert(`Payment Successful! ID Activated for ${currentPlan.validityDays} Days.`, true);
        setTimeout(() => { startSecurityCheck(phone); }, 1500);
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isFromAutoLogin = urlParams.has("autoLogin");
    const isApp = navigator.userAgent.includes('wv') || navigator.userAgent.includes('Median');

    // APP SE BROWSER REDIRECT
    if (isApp && !isFromAutoLogin) {
        const currentWebsiteUrl = window.location.origin + window.location.pathname;
        const targetUrl = currentWebsiteUrl + "?autoLogin=" + phone + "&action=pay_razorpay&plan=" + currentPlan.amount;
        
        // Ensure browser opens with full plan parameters
        const cleanUrl = targetUrl.replace(/^https?:\/\//, '');
        const scheme = targetUrl.startsWith('http://') ? 'http' : 'https';
        const chromeIntent = "intent://" + cleanUrl + "#Intent;scheme=" + scheme + ";package=com.android.chrome;action=android.intent.action.VIEW;S.android.support.customtabs.extra.SESSION=true;end;";

        try {
            window.location.href = chromeIntent;
        } catch(e) {
            window.location.href = targetUrl;
        }
        return;
    }

    var options = {
        "key": "rzp_live_T5PWVVwFz9BoeH", 
        "amount": amountInPaise, 
        "currency": "INR",
        "name": "ZIGO CAB",
        "description": `${currentPlan.validityDays} Days (${currentPlan.title}) Activation`,
        "image": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgRKDNzpQNcVONkcqZFhvilVp1K1mG1PkW4937hosZWNg6DMtGfbXf3aJswUPSaYmFxo1y7V_gf-HEqzIVKYXmywA8wdjw-5Oc19fowtVP3Ov4zvY5hwDelTiMLP1aB0l_SU5xcipqjQbre0YJ9L98PMJgo9OqkRC_8_WMsB3sp7CxWO3AutwE1_xFdXqAP/s1600/20251214_071928.png",
        "notes": {
            "phone": phone,
            "planAmount": currentPlan.amount,
            "validityDays": currentPlan.validityDays
        },
        "handler": async function (response) {
            try {
                const userRef = doc(db, "partners", phone);
                await setDoc(userRef, { 
                    recharge: "active", 
                    status: "approved", 
                    date: Date.now(),
                    planAmount: currentPlan.amount,
                    validityDays: currentPlan.validityDays,
                    paymentId: response.razorpay_payment_id 
                }, { merge: true });

                localStorage.setItem("zigo_old_user_" + phone, "true");
                window.showPortalAlert(`Payment Successful! ID Activated for ${currentPlan.validityDays} Days.`, true);
                startSecurityCheck(phone);
            } catch (e) {
                window.showPortalAlert("Database error! Take screenshot of Payment ID: " + response.razorpay_payment_id, false);
            }
        },
        "prefill": { "contact": phone },
        "theme": { "color": "#facc15" }
    };
    
    var rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response){ 
        window.showPortalAlert("Payment Failed: " + response.error.description, false); 
    });
    rzp.open();
};

window.startCashfreePayment = async () => {
    const phone = localStorage.getItem("zigo_logged_phone");
    if (!phone) return window.showPortalAlert("Please login to pay!", false);
    
    if (phone === "9999999999") {
        localStorage.setItem("zigo_demo_paid", "true");
        window.showPortalAlert("Payment Successful! ID Activated.", true);
        setTimeout(() => { startSecurityCheck(phone); }, 1500);
        return;
    }

    try {
        window.showPortalAlert("Initiating Secure Payment...", true);
        const currentPlan = window.selectedPlan || { amount: 99, validityDays: 28 };
        const response = await fetch('/.netlify/functions/create-order', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ phone: phone, amount: currentPlan.amount }) 
        });
        const data = await response.json();
        if (!data.payment_session_id) { window.showPortalAlert("Payment gateway error. Check Netlify logs.", false); return; }
        const cashfree = window.Cashfree({ mode: "production" });
        cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: "_modal" }).then((result) => {
            if(result.error){ window.showPortalAlert("Payment Failed: " + result.error.message, false); }
            if(result.paymentDetails){
                const userRef = doc(db, "partners", phone);
                setDoc(userRef, { 
                    recharge: "active", 
                    status: "approved", 
                    date: Date.now(), 
                    planAmount: currentPlan.amount,
                    validityDays: currentPlan.validityDays,
                    paymentGateway: "Cashfree" 
                }, { merge: true }).then(() => {
                    localStorage.setItem("zigo_old_user_" + phone, "true");
                    window.showPortalAlert(`Payment Successful! ID Activated for ${currentPlan.validityDays} Days.`, true);
                    startSecurityCheck(phone);
                }).catch((e) => { window.showPortalAlert("Database error! Please contact admin.", false); });
            }
        });
    } catch (error) { window.showPortalAlert("Error connecting to payment server.", false); }
};

window.showPortalAlert = (msg, isSuccess = true) => {
    const modal = document.getElementById("driverCustomAlertModal");
    if (modal) {
        document.getElementById("driverCustomAlertText").innerText = msg;
        document.getElementById("driverCustomAlertIcon").className = isSuccess ? "fa fa-circle-check text-green-400 text-4xl mb-3" : "fa fa-triangle-exclamation text-yellow-400 text-4xl mb-3 animate-pulse";
        modal.classList.remove("hidden");
    } else {
        alert(msg);
    }
};

window.closeCustomAlert = () => { document.getElementById("driverCustomAlertModal").classList.add("hidden"); };

window.showAdminNotifications = () => {
    document.getElementById("forceUpdateMessage").innerText = "System updates and new features are available. Please update the app.";
    document.getElementById("forceUpdateModal").classList.remove("hidden");
    const originalClose = document.getElementById("closeAppUpdateBtn").onclick;
    document.getElementById("closeAppUpdateBtn").onclick = () => {
        document.getElementById("forceUpdateModal").classList.add("hidden");
        if(originalClose) document.getElementById("closeAppUpdateBtn").onclick = originalClose;
    };
};

function listenToGlobalPromotions() {
    onSnapshot(doc(db, "app_settings", "update_config"), (snapshot) => {
        if(snapshot.exists()) {
            const data = snapshot.data();
            const serverTime = data.timestamp ? data.timestamp.toDate().getTime() : Date.now();
            if (data.status === "force_update" && ((Date.now() - serverTime) / 3600000) < 24 && !sessionStorage.getItem("zigo_dismiss_update_"+data.version_id)) {
                isAppUpdateActive = true;
                document.getElementById("forceUpdateMessage").innerText = data.message || "New core system file update available.";
                document.getElementById("forceUpdateModal").classList.remove("hidden");
                document.getElementById("imageBannerModal").classList.add("hidden");
                if(imageTimeoutTracker) clearTimeout(imageTimeoutTracker);
                document.getElementById("forceUpdateLinkBtn").onclick = () => { if(data.url) window.open(data.url, "_blank"); };
                document.getElementById("closeAppUpdateBtn").onclick = () => {
                    sessionStorage.setItem("zigo_dismiss_update_"+data.version_id, "true");
                    document.getElementById("forceUpdateModal").classList.add("hidden");
                    isAppUpdateActive = false; evaluateImageBannerTrigger();
                };
            } else { document.getElementById("forceUpdateModal").classList.add("hidden"); isAppUpdateActive = false; evaluateImageBannerTrigger(); }
        } else { document.getElementById("forceUpdateModal").classList.add("hidden"); isAppUpdateActive = false; evaluateImageBannerTrigger(); }
    });
}

function evaluateImageBannerTrigger() {
    if(imageTimeoutTracker) clearTimeout(imageTimeoutTracker);
    getDoc(doc(db, "app_settings", "image_config")).then((snapshot) => {
        if(snapshot.exists()) {
            const data = snapshot.data();
            const serverTime = data.timestamp ? data.timestamp.toDate().getTime() : Date.now();
            if(data.status === "active" && ((Date.now() - serverTime) / 3600000) < 24 && !sessionStorage.getItem("zigo_dismiss_img_"+data.version_id)) {
                if(isAppUpdateActive) { imageTimeoutTracker = setTimeout(() => { if(!isAppUpdateActive && !sessionStorage.getItem("zigo_dismiss_img_"+data.version_id)) triggerDisplayImageBanner(data); }, 30000); } else { triggerDisplayImageBanner(data); }
            } else { document.getElementById("imageBannerModal").classList.add("hidden"); }
        } else { document.getElementById("imageBannerModal").classList.add("hidden"); }
    });
}

function triggerDisplayImageBanner(data) {
    const promoImg = document.getElementById("promoBannerImg");
    promoImg.src = data.imageUrl;
    document.getElementById("imageBannerModal").classList.remove("hidden");
    if(data.redirectUrl && data.redirectUrl.trim() !== "") { promoImg.style.cursor = "pointer"; promoImg.onclick = () => window.open(data.redirectUrl, "_blank"); } else { promoImg.style.cursor = "default"; promoImg.onclick = null; }
    document.getElementById("closeImagePromoBtn").onclick = () => { sessionStorage.setItem("zigo_dismiss_img_"+data.version_id, "true"); document.getElementById("imageBannerModal").classList.add("hidden"); };
}

window.recoverPasswordSystem = async () => {
    const phone = document.getElementById("forgotPhone").value.trim();
    const criteria = document.getElementById("forgotCriteria").value.trim().toLowerCase();
    document.getElementById("recoveryResultBox").classList.add("hidden"); document.getElementById("recoveryErrorBox").classList.add("hidden");
    if(!phone || !criteria) { window.showPortalAlert("Bhai, dono details bharna zaroori hai!", false); return; }
    try {
        const docSnap = await getDoc(doc(db, "partners", phone));
        if(docSnap.exists()) {
            const data = docSnap.data();
            const dbName = data.name ? data.name.toLowerCase().replace(/\s+/g, '') : "";
            const dbDl = data.dl ? data.dl.toLowerCase().replace(/\s+/g, '') : "";
            const cleanCriteria = criteria.replace(/\s+/g, '');
            const dlLast6 = dbDl.length >= 6 ? dbDl.substring(dbDl.length - 6) : "xyz_dummy";

            if((dbName !== "" && dbName === cleanCriteria) || (dbDl !== "" && dlLast6 === cleanCriteria)) {
                document.getElementById("retrievedPass").innerText = data.password;
                document.getElementById("recoveryResultBox").classList.remove("hidden");
            } else { document.getElementById("recoveryErrorBox").classList.remove("hidden"); }
        } else { document.getElementById("recoveryErrorBox").classList.remove("hidden"); }
    } catch(e) { window.showPortalAlert("Error connecting to recovery network.", false); }
};

window.sendSupport = (type) => {
    let phone = localStorage.getItem("zigo_logged_phone") || "NewUser";
    let email = "helpmsapps@gmail.com";
    let subject = "";
    let body = "";
    
    if(type === 'block') { subject = "Account Blocked"; body = `[ZIGO SECURITY] Bhai, Meri ID (${phone}) Block hai. Please review karke unblock kardo.`; }
    if(type === 'reject') { subject = "Account Rejected"; body = `[ZIGO ADMIN] Bhai, Meri Request (${phone}) Reject hui hai. Kya document update karna hai?`; }
    if(type === 'forgot') { subject = "Password Recovery"; body = `[ZIGO HELP] Bhai, Mai ID (${document.getElementById('forgotPhone').value}) ka password bhool gaya hoon. Mera Recovery Input: ${document.getElementById('forgotCriteria').value}. Please check karke btao.`; }
    if(type === 'recharge') { 
        const amount = window.selectedPlan?.amount || 99;
        subject = "Payment Done"; 
        body = `[ZIGO PAYMENT] Bhai, ₹${amount} ka Activation Payment kar diya hai ID (${phone}) ke liye.`; 
    }
    
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

window.showObStep = (type) => {
    document.getElementById('obStep1').classList.add('hidden'); document.getElementById('obStep2').classList.add('hidden'); document.getElementById('obStep3').classList.add('hidden');
    document.getElementById('obStep'+type).classList.remove('hidden');
};

window.finishOnboarding = () => {
    const phone = localStorage.getItem("zigo_logged_phone");
    if(phone) { localStorage.setItem("zigo_onboarding_" + phone, "true"); showScreen('dashboardView'); if(window.bootDriverApp) window.bootDriverApp(phone, window.zigoCurrentUser?.vehicle || 'Car', window.zigoCurrentUser?.name || 'Partner'); }
};

function startSecurityCheck(phone) {
    if (phone === "9999999999") { 
        if(!localStorage.getItem("zigo_demo_paid")) {
            showScreen('rechargeArea'); 
            return;
        } else {
            showScreen('dashboardView'); 
            if(window.bootDriverApp) window.bootDriverApp(phone, "Cab", "Demo Driver"); 
            return; 
        }
    }
    
    onSnapshot(doc(db, "partners", phone), (snapshot) => {
        if (!snapshot.exists()) { showScreen('rejectScreen'); return; }
        const data = snapshot.data(); window.zigoCurrentUser = data;
        if(data.status === "blocked") { showScreen('blockScreen'); return; }
        let isExpired = false;
        
        if (data.recharge === "active" && data.date) {
            let rechargeTime = typeof data.date === 'string' ? new Date(data.date).getTime() : data.date;
            let validityDaysLimit = data.validityDays ? Number(data.validityDays) : 28;
            
            if (!isNaN(rechargeTime)) {
                let daysPassed = (Date.now() - rechargeTime) / (1000 * 3600 * 24);
                if (daysPassed >= validityDaysLimit) {
                    isExpired = true;
                    data.recharge = "expired";
                    setDoc(doc(db, "partners", phone), { recharge: "expired" }, { merge: true });
                }
            }
        }
        
        if (data.status === "approved") {
            if (data.recharge === "active" && !isExpired) {
                if(!localStorage.getItem("zigo_onboarding_" + phone)) { 
                    showScreen('onboardingScreen'); 
                    window.showObStep(1); 
                } else { 
                    showScreen('dashboardView'); 
                    if(window.bootDriverApp) window.bootDriverApp(phone, data.vehicle, data.name); 
                }
                localStorage.setItem("zigo_old_user_" + phone, "true");
            } else { 
                showScreen('rechargeArea');
            }
        } else if (data.status === "pending") { 
            showScreen('reviewScreen'); 
        }
    });
}

window.registerPartner = async () => {
    const btn = document.getElementById('genBtn');
    const phone = document.getElementById('regPhone').value.trim();
    const name = document.getElementById('regName').value.trim();
    const dob = document.getElementById('regDob').value; 
    const dlImageInput = document.getElementById('regDLImage');

    if(!name || !phone || !dob) return window.showPortalAlert("Bhai Name, Phone aur Date of Birth bharna zaroori hai!", false);
    if(!dlImageInput || !dlImageInput.files[0]) return window.showPortalAlert("Bhai, DL ki photo upload karna zaroori hai!", false);

    btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Checking Data...`; 
    btn.disabled = true;

    try {
        const checkSnap = await getDoc(doc(db, "partners", phone));
        if(checkSnap.exists()) { 
            window.showPortalAlert("⚠️ Yeh Mobile Number pehle se registered hai! Aap isse dobara register nahi kar sakte jab tak Admin ise delete na kare.", false); 
            btn.innerHTML = "Create Profile"; btn.disabled = false; return; 
        }

        const imageFile = dlImageInput.files[0];
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(imageFile);
        });
        const base64Image = await base64Promise;

        btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Secure Uploading...`;

        const imgbbResponse = await fetch('/.netlify/functions/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });
        const imgbbData = await imgbbResponse.json();
        
        if(!imgbbData.success) {
            window.showPortalAlert("Photo upload fail ho gayi. Network check karein.", false);
            btn.innerHTML = "Create Profile"; btn.disabled = false; return;
        }

        const dlImageUrl = imgbbData.data.url;
        btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Saving Profile...`;

        const password = Math.floor(1000 + Math.random() * 9000);
        await setDoc(doc(db, "partners", phone), { 
            name, phone, dob, 
            city: document.getElementById('regCity').value, 
            vehicle: document.getElementById('regVehicle').value, 
            vNo: document.getElementById('regVNo').value, 
            dl: document.getElementById('regDL').value,
            dlImageUrl: dlImageUrl, dlImage: dlImageUrl,
            password, status: "pending", recharge: "expired", 
            date: Date.now()
        });
        
        localStorage.setItem("zigo_logged_phone", phone); 
        startSecurityCheck(phone);
    } catch (e) { 
        console.error(e);
        window.showPortalAlert("Network error processing registration.", false); 
        btn.disabled = false; btn.innerText = "Submit Application"; 
    }
};

window.loginPartner = async () => {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPass').value;
    if(!phone || !pass) return window.showPortalAlert("Details dalo!", false);
    if (phone === "9999999999" && pass === "6655") { localStorage.setItem("zigo_logged_phone", phone); startSecurityCheck(phone); return; }
    const docSnap = await getDoc(doc(db, "partners", phone));
    if (docSnap.exists() && docSnap.data().password == pass) { localStorage.setItem("zigo_logged_phone", phone); startSecurityCheck(phone); } else { window.showPortalAlert("Login Failed! Please enter correct credentials.", false); }
};

window.logout = () => { 
    localStorage.removeItem("zigo_logged_phone"); 
    localStorage.removeItem("msPartnerMobile"); 
    localStorage.removeItem("zigo_demo_paid");
    localStorage.removeItem("zigo_selected_plan_amt");
    localStorage.removeItem("zigo_selected_plan_days");
    location.reload(); 
};

window.showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); 
    const targetScreen = document.getElementById(id);
    if(targetScreen) targetScreen.classList.remove('hidden');

    if(['dashboardView', 'blockScreen', 'rejectScreen', 'rechargeArea', 'onboardingScreen'].includes(id)) { 
        document.getElementById('mainContent').classList.add('hidden'); 
    } else { 
        document.getElementById('mainContent').classList.remove('hidden'); 
    }

    if(id === 'loginArea') { if(window.playZigoAudio) window.playZigoAudio('audioLogin'); }
    if(id === 'rechargeArea') { if(window.playZigoAudio) window.playZigoAudio('audioRecharge'); }
    if(id === 'congArea') { if(window.playZigoAudio) window.playZigoAudio('audioActivation'); }
};

window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const autoPhone = urlParams.get("autoLogin");
    const autoAction = urlParams.get("action");
    const planParam = urlParams.get("plan");

    // Exact plan detection: prioritize URL param, then stored choice, fallback to 99
    let chosenPlan = 99;
    if (planParam) {
        chosenPlan = Number(planParam);
    } else if (localStorage.getItem("zigo_selected_plan_amt")) {
        chosenPlan = Number(localStorage.getItem("zigo_selected_plan_amt"));
    }

    if (chosenPlan === 19) {
        selectRechargePlan(19, 1, '24 Hours Platform Access');
    } else if (chosenPlan === 49) {
        selectRechargePlan(49, 10, '10 Days Platform Access');
    } else {
        selectRechargePlan(99, 28, '28 Days Platform Access');
    }

    // BROWSER ME AUTO OPEN RAZORPAY GATEWAY WITH SELECTED AMOUNT
    if (autoPhone) {
        localStorage.setItem("zigo_logged_phone", autoPhone);
        localStorage.setItem("zigo_old_user_" + autoPhone, "true");
        showScreen('rechargeArea');

        if (autoAction === "pay_razorpay") {
            setTimeout(() => {
                window.startRazorpayPayment();
            }, 300);
            return;
        }
    }

    const saved = localStorage.getItem("zigo_logged_phone");
    if (saved) {
        startSecurityCheck(saved);
    } else {
        showScreen('loginArea');
    }
    
    listenToGlobalPromotions(); 
};

function checkAndShowStartupWeb() {
    if (sessionStorage.getItem("zigo_startup_web_shown")) return;

    getDoc(doc(db, "app_settings", "startup_web")).then((snapshot) => {
        if (snapshot.exists()) {
            const config = snapshot.data();
            if (config.isActive && config.url) {
                sessionStorage.setItem("zigo_startup_web_shown", "true");
                setTimeout(() => {
                    if (window.openFullWebPage) {
                        window.openFullWebPage(config.url);
                    }
                }, 1500);
            }
        }
    }).catch(e => console.log("Startup Web Error:", e));
}


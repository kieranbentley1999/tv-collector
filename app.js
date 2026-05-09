// App State
const API_URL = '/api';
let currentUser = null;
let userCoins = 0;
let userInventory = []; 
const PACK_COST = 500;
const CARDS_PER_PACK = 3;
const REWARD_AMOUNT = 1000;
const REWARD_INTERVAL = 60 * 60 * 1000; // 1 hour in ms
let lastClaimTime = 0;
let rewardTimerInterval = null;

// Drop Rates
const DROP_RATES = {
    Common: 0.60,
    Uncommon: 0.25,
    Rare: 0.12,
    "Super Rare": 0.03
};

// Sound Effects
const sfx = {
    click: new Audio('assets/sfx/click.wav'),
    whoosh: new Audio('assets/sfx/whoosh.wav'),
    legendary: new Audio('assets/sfx/legendary.wav'),
    reveal: new Audio('assets/sfx/reveal.wav')
};

// Debug: Check if audio loads
Object.values(sfx).forEach(audio => {
    audio.load();
    audio.onerror = () => console.error('Audio failed to load:', audio.src);
});

// DOM Elements
const elCoins = document.getElementById('coin-amount');
const elNavStore = document.getElementById('nav-store');
const elNavCollection = document.getElementById('nav-collection');
const elNavSets = document.getElementById('nav-sets');
const elNavCatalog = document.getElementById('nav-catalog');
const elViewStore = document.getElementById('view-store');
const elViewCollection = document.getElementById('view-collection');
const elViewCatalog = document.getElementById('view-catalog');
const elViewSets = document.getElementById('view-sets');
const elBuyPackBtn = document.getElementById('buy-pack-btn');

const elPackModal = document.getElementById('pack-modal');
const elPhasePack = document.getElementById('pack-reveal-phase');
const elPhaseCards = document.getElementById('card-reveal-phase');
const elPackInteractive = document.querySelector('.pack-interactive');
const elPulledCards = document.getElementById('pulled-cards-container');
const elFinishBtn = document.getElementById('finish-opening-btn');

const elCollectionGrid = document.getElementById('collection-grid');
const elCollectionCount = document.getElementById('collection-count');
const elTotalCardsCount = document.getElementById('total-cards-count');
const elRarityFilter = document.getElementById('rarity-filter');
const elSeriesFilter = document.getElementById('series-filter');

const elCatalogGrid = document.getElementById('catalog-grid');
const elCatalogCount = document.getElementById('catalog-total-count');
const elCatalogFilter = document.getElementById('catalog-rarity-filter');
const elCatalogSeriesFilter = document.getElementById('catalog-series-filter');
const elSetsGrid = document.getElementById('sets-grid');

const elRewardTimer = document.getElementById('reward-timer');
const elClaimBtn = document.getElementById('claim-reward-btn');

const elMobileNavStore = document.getElementById('mobile-nav-store');
const elMobileNavCollection = document.getElementById('mobile-nav-collection');
const elMobileNavSets = document.getElementById('mobile-nav-sets');
const elMobileNavCatalog = document.getElementById('mobile-nav-catalog');

const elNavAdmin = document.getElementById('nav-admin');
const elMobileNavAdmin = document.getElementById('mobile-nav-admin');
const elViewAdmin = document.getElementById('view-admin');
const elAdminUserList = document.getElementById('admin-user-list');
const elAdminTotalUsers = document.getElementById('admin-total-users');

const elNotificationContainer = document.getElementById('notification-container');

// Auth Elements
const elAuthOverlay = document.getElementById('auth-overlay');
const elAuthForm = document.getElementById('auth-form');
const elAuthUser = document.getElementById('auth-user');
const elAuthPass = document.getElementById('auth-pass');
const elAuthError = document.getElementById('auth-error');
const elTabLogin = document.getElementById('tab-login');
const elTabSignup = document.getElementById('tab-signup');
const elAuthSubmit = document.getElementById('auth-submit');
const elLogoutBtn = document.getElementById('logout-btn');

let authMode = 'login';

// Initialization
function init() {
    // Check for existing session
    const savedUser = localStorage.getItem('vault_user');
    if (savedUser) {
        autoLogin(savedUser);
    } else {
        elAuthOverlay.classList.remove('hidden');
    }

    // Auth Tab Switching
    elTabLogin.addEventListener('click', () => {
        authMode = 'login';
        elTabLogin.classList.add('active');
        elTabSignup.classList.remove('active');
        elAuthSubmit.textContent = 'Enter the Vault';
    });

    elTabSignup.addEventListener('click', () => {
        authMode = 'signup';
        elTabSignup.classList.add('active');
        elTabLogin.classList.remove('active');
        elAuthSubmit.textContent = 'Create Account';
    });

    // Auth Form Submission
    elAuthForm.addEventListener('submit', handleAuth);
    elLogoutBtn.addEventListener('click', handleLogout);

    elNavStore.addEventListener('click', () => switchView('store'));
    elNavCollection.addEventListener('click', () => switchView('collection'));
    elNavSets.addEventListener('click', () => switchView('sets'));
    elNavCatalog.addEventListener('click', () => switchView('catalog'));

    elMobileNavStore.addEventListener('click', () => switchView('store'));
    elMobileNavCollection.addEventListener('click', () => switchView('collection'));
    elMobileNavSets.addEventListener('click', () => switchView('sets'));
    elMobileNavCatalog.addEventListener('click', () => switchView('catalog'));

    elNavAdmin.addEventListener('click', () => switchView('admin'));
    elMobileNavAdmin.addEventListener('click', () => switchView('admin'));
    
    // Sound Test
    document.getElementById('sound-test').addEventListener('click', () => {
        sfx.click.play().then(() => alert('Sound is working!')).catch(e => alert('Audio blocked. Click the page first!'));
    });
    
    elBuyPackBtn.addEventListener('click', buyPack);
    elPackInteractive.addEventListener('click', openPack);
    elFinishBtn.addEventListener('click', closePackModal);
    elClaimBtn.addEventListener('click', claimReward);
    
    elRarityFilter.addEventListener('change', renderCollection);
    elSeriesFilter.addEventListener('change', renderCollection);
    
    elCatalogFilter.addEventListener('change', renderCatalog);
    elCatalogSeriesFilter.addEventListener('change', renderCatalog);

    updateCoinsDisplay();
    populateSeriesFilters();
    switchView('store');
}

async function autoLogin(username) {
    console.log('Auto-logging in:', username);
    try {
        const response = await fetch(`${API_URL}/login_auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        if (data.success) {
            currentUser = data.username;
            userInventory = data.inventory || [];
            userCoins = data.coins || 5000;
            lastClaimTime = data.last_claim || 0;
            elAuthOverlay.classList.add('hidden');
            elLogoutBtn.classList.remove('hidden');
            updateCoinsDisplay();
            checkAdminStatus();
            startRewardTimer();
            renderCollection();
            renderCatalog();
            showNotification('Reconnected to the Vault!', 'success');
        } else {
            localStorage.removeItem('vault_user');
            elAuthOverlay.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Auto-login failed');
        elAuthOverlay.classList.remove('hidden');
    }
}

function switchView(view) {
    // Hide all views and remove active state from nav
    elViewStore.classList.remove('active');
    elViewCollection.classList.remove('active');
    elViewCatalog.classList.remove('active');
    elViewSets.classList.remove('active');
    elViewAdmin.classList.remove('active');
    
    elNavStore.classList.remove('active');
    elNavCollection.classList.remove('active');
    elNavCatalog.classList.remove('active');
    elNavSets.classList.remove('active');
    elNavAdmin.classList.remove('active');

    elMobileNavStore.classList.remove('active');
    elMobileNavCollection.classList.remove('active');
    elMobileNavCatalog.classList.remove('active');
    elMobileNavSets.classList.remove('active');
    elMobileNavAdmin.classList.remove('active');
    
    if (view === 'store') {
        elViewStore.classList.add('active');
        elViewStore.classList.remove('hidden');
        elNavStore.classList.add('active');
        elMobileNavStore.classList.add('active');
    } else if (view === 'collection') {
        elViewCollection.classList.add('active');
        elViewCollection.classList.remove('hidden');
        elNavCollection.classList.add('active');
        elMobileNavCollection.classList.add('active');
        renderCollection();
    } else if (view === 'catalog') {
        elViewCatalog.classList.add('active');
        elViewCatalog.classList.remove('hidden');
        elNavCatalog.classList.add('active');
        elMobileNavCatalog.classList.add('active');
        renderCatalog();
    } else if (view === 'sets') {
        elViewSets.classList.add('active');
        elViewSets.classList.remove('hidden');
        elNavSets.classList.add('active');
        elMobileNavSets.classList.add('active');
        renderSets();
    } else if (view === 'admin') {
        elViewAdmin.classList.add('active');
        elViewAdmin.classList.remove('hidden');
        elNavAdmin.classList.add('active');
        elMobileNavAdmin.classList.add('active');
        fetchAdminData();
    }
}

function populateSeriesFilters() {
    const shows = [...new Set(PLAYERS.map(p => p.show))];
    shows.forEach(show => {
        const opt = document.createElement('option');
        opt.value = show;
        opt.textContent = show;
        elSeriesFilter.appendChild(opt.cloneNode(true));
        elCatalogSeriesFilter.appendChild(opt.cloneNode(true));
    });
}

// Logic: Buying a Pack
function buyPack() {
    if (!currentUser) {
        showNotification("Please login to buy packs!", "error");
        return;
    }
    if (userCoins < PACK_COST) {
        showNotification("Not enough coins!", "error");
        return;
    }

    userCoins -= PACK_COST;
    updateCoinsDisplay();
    syncData();
    
    startPackOpeningSequence();
}

function pullCards(numCards) {
    const pulled = [];
    for (let i = 0; i < numCards; i++) {
        let forcedRarity = null;
        if (i === numCards - 1) {
            const hasGoodCard = pulled.some(p => ['Rare', 'Super Rare'].includes(p.rarity));
            if (!hasGoodCard) forcedRarity = 'Rare';
        }

        const rarity = forcedRarity || determineRarity();
        // EXCLUDE MYTHICS FROM PACKS
        const availablePlayers = PLAYERS.filter(p => p.rarity !== 'Mythic');
        const randomPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
        const pulledCard = { ...randomPlayer, rarity: rarity };
        pulled.push(pulledCard);
        
        const invKey = `${randomPlayer.id}-${rarity}`;
        userInventory.push(invKey);
    }
    syncData();
    return pulled;
}

function determineRarity() {
    const rand = Math.random();
    let cumulative = 0;
    if (rand < DROP_RATES["Super Rare"]) return 'Super Rare';
    cumulative += DROP_RATES["Super Rare"];
    if (rand < cumulative + DROP_RATES.Rare) return 'Rare';
    cumulative += DROP_RATES.Rare;
    if (rand < cumulative + DROP_RATES.Uncommon) return 'Uncommon';
    return 'Common';
}

function startPackOpeningSequence() {
    elPhasePack.classList.remove('hidden');
    elPhaseCards.classList.add('hidden');
    elPackInteractive.classList.remove('shake');
    elPulledCards.innerHTML = '';
    elFinishBtn.classList.add('hidden');
    elPackModal.classList.remove('hidden');
}

function openPack() {
    elPackInteractive.classList.add('shake');
    sfx.whoosh.play();
    setTimeout(() => {
        elPhasePack.classList.add('hidden');
        elPhaseCards.classList.remove('hidden');
        const cards = pullCards(CARDS_PER_PACK);
        renderPulledCards(cards);
    }, 1000);
}

function renderPulledCards(cards) {
    let flippedCount = 0;
    cards.forEach((player, index) => {
        const cardHTML = generateCardElement(player, true);
        cardHTML.style.opacity = '0';
        cardHTML.style.transform = 'translateY(50px)';
        elPulledCards.appendChild(cardHTML);
        
        setTimeout(() => {
            cardHTML.style.transition = 'all 0.5s ease';
            cardHTML.style.opacity = '1';
            cardHTML.style.transform = 'translateY(0)';
            sfx.reveal.currentTime = 0;
            sfx.reveal.play();
            
            setTimeout(() => {
                cardHTML.style.transform = '';
                cardHTML.style.transition = '';
            }, 500);
        }, index * 200);

        cardHTML.addEventListener('click', function() {
            if (!this.classList.contains('flipped')) {
                this.classList.add('flipped');
                flippedCount++;
                if (player.rarity === 'Super Rare') {
                    showNotification(`⭐ SUPER RARE PULL: ${player.name}! ⭐`, 'success');
                    sfx.legendary.play();
                }
                if (flippedCount === CARDS_PER_PACK) elFinishBtn.classList.remove('hidden');
            }
        });
    });
}

function closePackModal() {
    elPackModal.classList.add('hidden');
}

function generateCardElement(player, faceDown = false) {
    const el = document.createElement('div');
    el.className = `player-card ${faceDown ? '' : 'flipped'}`;
    const p = player;
    el.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front" data-rarity="${p.rarity}">
            ${p.rarity === 'Super Rare' ? '<div class="legendary-shine"></div>' : ''}
            ${p.rarity === 'Mythic' ? '<div class="mythic-shine"></div>' : ''}
            ${p.img ? `<img src="${p.img}" class="player-photo" onerror="this.style.opacity='0'">` : ''}
            <div class="card-overlay">
                <div class="card-show">${p.show}</div>
                <div class="card-name">${p.name}</div>
                <div class="card-role">${p.role}</div>
            </div>
        </div>
    `;
    return el;
}

function renderCollection() {
    elCollectionGrid.innerHTML = '';
    const filterRarity = elRarityFilter.value;
    const filterSeries = elSeriesFilter.value;
    
    const inventoryCounts = {};
    userInventory.forEach(key => {
        inventoryCounts[key] = (inventoryCounts[key] || 0) + 1;
    });

    const RARITIES = ['Mythic', 'Super Rare', 'Rare', 'Uncommon', 'Common'];
    const processedKeys = new Set();
    let uniqueCount = 0;
    
    RARITIES.forEach(rarity => {
        if (filterRarity !== 'all' && rarity !== filterRarity) return;
        PLAYERS.forEach(player => {
            if (filterSeries !== 'all' && player.show !== filterSeries) return;
            const invKey = `${player.id}-${rarity}`;
            if (!inventoryCounts[invKey] || processedKeys.has(invKey)) return;
            processedKeys.add(invKey);
            
            uniqueCount++;
            const count = inventoryCounts[invKey];
            const p = { ...player, rarity: rarity };
            const wrapper = document.createElement('div');
            wrapper.className = `collection-card owned`;
            wrapper.innerHTML = `
                <div class="card-face card-front" data-rarity="${p.rarity}" style="transform: none;">
                    ${p.rarity === 'Super Rare' ? '<div class="legendary-shine"></div>' : ''}
                    ${p.rarity === 'Mythic' ? '<div class="mythic-shine"></div>' : ''}
                    ${count > 1 ? `<div class="duplicate-badge">x${count}</div>` : ''}
                    ${p.img ? `<img src="${p.img}" class="player-photo" onerror="this.style.opacity='0'">` : ''}
                    <div class="card-overlay">
                        <div class="card-show">${p.show}</div>
                        <div class="card-name">${p.name}</div>
                        <div class="card-role">${p.role}</div>
                    </div>
                </div>
            `;
            elCollectionGrid.appendChild(wrapper);
        });
    });
    elCollectionCount.textContent = uniqueCount;
    elTotalCardsCount.textContent = userInventory.length;
}

function renderCatalog() {
    elCatalogGrid.innerHTML = '';
    const filterRarity = elCatalogFilter.value;
    const filterSeries = elCatalogSeriesFilter.value;
    const RARITIES = ['Mythic', 'Super Rare', 'Rare', 'Uncommon', 'Common'];
    let totalPossible = 0;
    
    RARITIES.forEach(rarity => {
        if (filterRarity !== 'all' && rarity !== filterRarity) return;
        PLAYERS.forEach(player => {
            if (filterSeries !== 'all' && player.show !== filterSeries) return;
            totalPossible++;
            const p = { ...player, rarity: rarity };
            const wrapper = document.createElement('div');
            wrapper.className = `collection-card owned`;
            wrapper.innerHTML = `
                <div class="card-face card-front" data-rarity="${p.rarity}" style="transform: none;">
                    ${p.rarity === 'Super Rare' ? '<div class="legendary-shine"></div>' : ''}
                    ${p.rarity === 'Mythic' ? '<div class="mythic-shine"></div>' : ''}
                    ${p.img ? `<img src="${p.img}" class="player-photo" onerror="this.style.opacity='0'">` : ''}
                    <div class="card-overlay">
                        <div class="card-show">${p.show}</div>
                        <div class="card-name">${p.name}</div>
                        <div class="card-role">${p.role}</div>
                    </div>
                </div>
            `;
            elCatalogGrid.appendChild(wrapper);
        });
    });
    elCatalogCount.textContent = totalPossible;
}

function renderSets() {
    elSetsGrid.innerHTML = '';
    const shows = [...new Set(PLAYERS.map(p => p.show))];
    
    // Get unique owned card IDs (rarity doesn't matter for sets, just having the character)
    const ownedIds = new Set(userInventory.map(key => parseInt(key.split('-')[0])));

    shows.forEach(show => {
        const showCards = PLAYERS.filter(p => p.show === show && p.rarity !== 'Mythic');
        const mythicCard = PLAYERS.find(p => p.show === show && p.rarity === 'Mythic');
        
        if (showCards.length === 0) return; // Skip shows with no base cards

        const ownedCount = showCards.filter(p => ownedIds.has(p.id)).length;
        const percent = Math.floor((ownedCount / showCards.length) * 100);
        const isComplete = ownedCount === showCards.length;
        const alreadyHasMythic = mythicCard ? userInventory.includes(`${mythicCard.id}-Mythic`) : true;

        const setCard = document.createElement('div');
        setCard.className = `set-card ${isComplete ? 'complete' : ''}`;
        setCard.innerHTML = `
            <div class="set-info">
                <h3>${show}</h3>
                <div class="set-progress-container">
                    <div class="set-progress-bar" style="width: ${percent}%"></div>
                </div>
                <div class="set-stats">${ownedCount} / ${showCards.length} Cards Collected</div>
            </div>
            ${(isComplete && mythicCard && !alreadyHasMythic) ? 
                `<button class="claim-mythic-btn" onclick="claimMythic('${show}')">Claim Mythic Reward!</button>` : 
                (alreadyHasMythic && mythicCard && isComplete ? `<div class="mythic-unlocked">💎 Mythic Unlocked</div>` : ``)
            }
        `;
        elSetsGrid.appendChild(setCard);
    });
}

async function claimMythic(showName) {
    const mythicCard = PLAYERS.find(p => p.show === showName && p.rarity === 'Mythic');
    if (!mythicCard) return;

    const invKey = `${mythicCard.id}-Mythic`;
    if (userInventory.includes(invKey)) return;

    userInventory.push(invKey);
    syncData();
    renderSets();
    
    // Epic Animation Effect
    showNotification(`💎 MYTHIC UNLOCKED: ${mythicCard.name}! 💎`, 'success');
    sfx.legendary.play();
    
    // Optional: Show the card in a modal for impact
    startPackOpeningSequence();
    elPhasePack.classList.add('hidden');
    elPhaseCards.classList.remove('hidden');
    renderPulledCards([{ ...mythicCard, rarity: 'Mythic' }]);
}

function updateCoinsDisplay() {
    if (currentUser === 'kierannb') {
        elCoins.textContent = 'ADMIN ♾️';
    } else {
        elCoins.textContent = userCoins.toLocaleString();
    }
}

function showNotification(message, type = 'success') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `<span>${type === 'error' ? '❌' : '✨'}</span><span>${message}</span>`;
    elNotificationContainer.appendChild(notif);
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

async function handleAuth(e) {
    e.preventDefault();
    const username = elAuthUser.value;
    const password = elAuthPass.value;
    const endpoint = authMode === 'login' ? '/login' : '/signup';
    try {
        const response = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
            currentUser = data.username;
            userInventory = data.inventory || [];
            userCoins = data.coins || 5000;
            lastClaimTime = data.last_claim || 0;
            
            localStorage.setItem('vault_user', currentUser);
            elLogoutBtn.classList.remove('hidden');

            if (authMode === 'signup') {
                showNotification('Account Created! Welcome to the Vault!', 'success');
                // No need to click login tab, just proceed
            } else {
                showNotification('Welcome back to the Vault!', 'success');
            }

            // MIGRATION: Check for old local cards and move them to account
            const localInv = JSON.parse(localStorage.getItem('tv_inventory') || localStorage.getItem('tv_collection') || '[]');
            const localCoins = parseInt(localStorage.getItem('tv_coins')) || 0;
            
            if (localInv.length > 0 || localCoins > 0) {
                console.log('Migrating local data to account...');
                // Merge unique cards
                const combined = [...new Set([...userInventory, ...localInv])];
                userInventory = combined;
                userCoins = Math.max(userCoins, localCoins);
                
                // Clear local legacy data
                localStorage.removeItem('tv_inventory');
                localStorage.removeItem('tv_collection');
                localStorage.removeItem('tv_coins');
                
                syncData(); // Save to server immediately
                showNotification('Legacy collection migrated to your account!', 'success');
            }

            elAuthOverlay.classList.add('hidden');
            updateCoinsDisplay();
            checkAdminStatus();
            startRewardTimer();
            renderCollection();
            renderCatalog();
        } else {
            elAuthError.textContent = data.message;
            elAuthError.classList.remove('hidden');
        }
    } catch (err) {
        elAuthError.textContent = 'Server Connection Failed';
        elAuthError.classList.remove('hidden');
    }
}

async function syncData() {
    if (!currentUser) return;
    try {
        await fetch(API_URL + '/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: currentUser, 
                inventory: userInventory, 
                coins: userCoins,
                last_claim: lastClaimTime
            })
        });
    } catch (err) { console.error('Failed to sync data with server'); }
}

function startRewardTimer() {
    if (rewardTimerInterval) clearInterval(rewardTimerInterval);
    updateRewardUI();
    rewardTimerInterval = setInterval(updateRewardUI, 1000);
}

function updateRewardUI() {
    if (!currentUser) return;
    
    const now = Date.now();
    const nextClaim = lastClaimTime + REWARD_INTERVAL;
    const diff = nextClaim - now;
    
    if (diff <= 0) {
        elRewardTimer.classList.add('hidden');
        elClaimBtn.classList.remove('hidden');
    } else {
        elRewardTimer.classList.remove('hidden');
        elClaimBtn.classList.add('hidden');
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        
        elRewardTimer.textContent = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

function claimReward() {
    if (!currentUser) return;
    
    const now = Date.now();
    if (now >= lastClaimTime + REWARD_INTERVAL) {
        userCoins += REWARD_AMOUNT;
        lastClaimTime = now;
        updateCoinsDisplay();
        syncData();
        startRewardTimer();
        showNotification(`💰 Claimed ${REWARD_AMOUNT.toLocaleString()} coins!`, 'success');
        sfx.legendary.play();
    }
}

function handleLogout() {
    currentUser = null;
    userInventory = [];
    userCoins = 0;
    localStorage.removeItem('vault_user');
    elLogoutBtn.classList.add('hidden');
    
    // Hide admin tabs on logout
    elNavAdmin.classList.add('hidden');
    elMobileNavAdmin.classList.add('hidden');
    
    elAuthOverlay.classList.remove('hidden');
    elAuthUser.value = '';
    elAuthPass.value = '';
    showNotification('Logged out successfully');
}

function checkAdminStatus() {
    if (currentUser === 'kierannb') {
        elNavAdmin.classList.remove('hidden');
        elMobileNavAdmin.classList.remove('hidden');
    } else {
        elNavAdmin.classList.add('hidden');
        elMobileNavAdmin.classList.add('hidden');
    }
}

async function fetchAdminData() {
    if (currentUser !== 'kierannb') return;
    
    try {
        const response = await fetch(API_URL + '/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_username: currentUser })
        });
        const data = await response.json();
        if (data.success) {
            renderAdminUsers(data.users);
        }
    } catch (err) {
        showNotification('Failed to fetch admin data', 'error');
    }
}

function renderAdminUsers(users) {
    elAdminUserList.innerHTML = '';
    elAdminTotalUsers.textContent = users.length;
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const lastClaimStr = user.last_claim ? new Date(user.last_claim).toLocaleString() : 'Never';
        row.innerHTML = `
            <td>${user.username} ${user.username === 'kierannb' ? '👑' : ''}</td>
            <td>💰 ${user.coins.toLocaleString()}</td>
            <td>🃏 ${user.inventory_count}</td>
            <td>${lastClaimStr}</td>
        `;
        elAdminUserList.appendChild(row);
    });
}

init();

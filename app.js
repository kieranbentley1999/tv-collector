// App State
const API_URL = '/api';
let currentUser = null;
let userCoins = 0;
let userInventory = []; 
const PACK_COST = 500;
const CARDS_PER_PACK = 3;

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
const elNavCatalog = document.getElementById('nav-catalog');
const elViewStore = document.getElementById('view-store');
const elViewCollection = document.getElementById('view-collection');
const elViewCatalog = document.getElementById('view-catalog');
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
    elNavCatalog.addEventListener('click', () => switchView('catalog'));
    
    // Sound Test
    document.getElementById('sound-test').addEventListener('click', () => {
        sfx.click.play().then(() => alert('Sound is working!')).catch(e => alert('Audio blocked. Click the page first!'));
    });
    
    elBuyPackBtn.addEventListener('click', buyPack);
    elPackInteractive.addEventListener('click', openPack);
    elFinishBtn.addEventListener('click', closePackModal);
    
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
            elAuthOverlay.classList.add('hidden');
            elLogoutBtn.classList.remove('hidden');
            updateCoinsDisplay();
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
    
    elNavStore.classList.remove('active');
    elNavCollection.classList.remove('active');
    elNavCatalog.classList.remove('active');
    
    if (view === 'store') {
        elViewStore.classList.add('active');
        elViewStore.classList.remove('hidden');
        elNavStore.classList.add('active');
    } else if (view === 'collection') {
        elViewCollection.classList.add('active');
        elViewCollection.classList.remove('hidden');
        elNavCollection.classList.add('active');
        renderCollection();
    } else if (view === 'catalog') {
        elViewCatalog.classList.add('active');
        elViewCatalog.classList.remove('hidden');
        elNavCatalog.classList.add('active');
        renderCatalog();
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
        const randomPlayer = PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
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

    const RARITIES = ['Super Rare', 'Rare', 'Uncommon', 'Common'];
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
    const RARITIES = ['Super Rare', 'Rare', 'Uncommon', 'Common'];
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
            if (authMode === 'signup') {
                showNotification('Account Created! Now logging in...', 'success');
                authMode = 'login';
                elTabLogin.click();
                return;
            }
            currentUser = data.username;
            userInventory = data.inventory || [];
            userCoins = data.coins || 5000;
            
            localStorage.setItem('vault_user', currentUser);
            elLogoutBtn.classList.remove('hidden');

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
            showNotification('Welcome back to the Vault!', 'success');
            updateCoinsDisplay();
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
            body: JSON.stringify({ username: currentUser, inventory: userInventory, coins: userCoins })
        });
    } catch (err) { console.error('Failed to sync data with server'); }
}

function handleLogout() {
    currentUser = null;
    userInventory = [];
    userCoins = 0;
    localStorage.removeItem('vault_user');
    elLogoutBtn.classList.add('hidden');
    elAuthOverlay.classList.remove('hidden');
    elAuthUser.value = '';
    elAuthPass.value = '';
    showNotification('Logged out successfully');
}

init();

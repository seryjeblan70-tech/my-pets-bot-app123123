import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { api } from './api';

// -------------------- Telegram --------------------
const tg = window.Telegram?.WebApp;

// -------------------- Types --------------------
interface Pet {
  id: string;
  emoji: string;
  name: string;
  unlock: 'start' | 'level' | 'invite' | 'event';
  level?: number;
  invites?: number;
  bonus?: { type: 'clickPower' | 'regen' | 'maxStamina'; value: number };
  maxLevel?: number;
  upgradeCost?: (level: number) => number;
}

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  emoji: string;
  quantity: number;
  type: 'food' | 'boost' | 'skin' | 'goldenTicket';
  effect?: { type: string; value: number; duration?: number };
}

interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
  type: 'feed' | 'click' | 'play' | 'invite' | 'upgrade';
}

interface DailyBonus {
  lastClaimDate: string;
  streak: number;
  claimedToday: boolean;
}

interface SpecialEvent {
  active: boolean;
  type: 'rarePet' | 'doubleRewards' | 'boss';
  expiresAt: number;
  data?: any;
}

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

// -------------------- Constants --------------------
const MAX_FOOD = 100;
const BASE_CLICK_POWER = 1;
const MAX_FOOD_PURCHASES_PER_DAY = 10;

const PETS: Pet[] = [
  { id: 'dog', emoji: '🐶', name: 'Собачка', unlock: 'start', bonus: { type: 'clickPower', value: 0.1 }, maxLevel: 5, upgradeCost: (lvl) => 20 + lvl * 10 },
  { id: 'cat', emoji: '🐱', name: 'Кошка', unlock: 'start', bonus: { type: 'regen', value: 0.2 }, maxLevel: 5, upgradeCost: (lvl) => 20 + lvl * 10 },
  { id: 'rabbit', emoji: '🐰', name: 'Зайчик', unlock: 'start', bonus: { type: 'maxStamina', value: 5 }, maxLevel: 5, upgradeCost: (lvl) => 20 + lvl * 10 },
  { id: 'fox', emoji: '🦊', name: 'Лиса', unlock: 'level', level: 5, bonus: { type: 'clickPower', value: 0.2 }, maxLevel: 5, upgradeCost: (lvl) => 30 + lvl * 15 },
  { id: 'panda', emoji: '🐼', name: 'Панда', unlock: 'level', level: 10, bonus: { type: 'regen', value: 0.3 }, maxLevel: 5, upgradeCost: (lvl) => 30 + lvl * 15 },
  { id: 'koala', emoji: '🐨', name: 'Коала', unlock: 'level', level: 15, bonus: { type: 'maxStamina', value: 10 }, maxLevel: 5, upgradeCost: (lvl) => 30 + lvl * 15 },
  { id: 'lion', emoji: '🦁', name: 'Лев', unlock: 'invite', invites: 3, bonus: { type: 'clickPower', value: 0.3 }, maxLevel: 5, upgradeCost: (lvl) => 40 + lvl * 20 },
  { id: 'unicorn', emoji: '🦄', name: 'Единорог', unlock: 'event', bonus: { type: 'regen', value: 0.5 }, maxLevel: 5, upgradeCost: (lvl) => 50 + lvl * 25 },
];

const INITIAL_QUESTS: Quest[] = [
  { id: 'q1', title: 'Накорми питомца', description: 'Покорми питомца 3 раза', target: 3, progress: 0, reward: 30, completed: false, type: 'feed' },
  { id: 'q2', title: 'Кликер', description: 'Сделай 100 кликов', target: 100, progress: 0, reward: 50, completed: false, type: 'click' },
  { id: 'q3', title: 'Игрок', description: 'Поиграй с питомцем 2 раза', target: 2, progress: 0, reward: 40, completed: false, type: 'play' },
  { id: 'q4', title: 'Пригласи друга', description: 'Пригласи 1 друга', target: 1, progress: 0, reward: 1000, completed: false, type: 'invite' },
  { id: 'q5', title: 'Улучшай!', description: 'Купи 1 улучшение в магазине', target: 1, progress: 0, reward: 60, completed: false, type: 'upgrade' },
];

const SHOP_ITEMS: InventoryItem[] = [
  { id: 'lucky_ticket', name: 'Счастливый билет', description: 'Удваивает клики на 30 секунд', emoji: '🎫', quantity: 0, type: 'boost', effect: { type: 'doubleClick', value: 2, duration: 30 } },
  { id: 'golden_ticket', name: 'Золотой билет', description: 'Удваивает алмазы на 60 секунд', emoji: '🎟️', quantity: 0, type: 'goldenTicket', effect: { type: 'doubleGems', value: 2, duration: 60 } },
  { id: 'food_bag', name: 'Мешок еды', description: '+30 еды', emoji: '🍖', quantity: 0, type: 'food' },
  { id: 'costume', name: 'Костюм супергероя', description: 'Изменяет внешность питомца на 1 час', emoji: '🦸', quantity: 0, type: 'skin' },
];

// -------------------- Helper: level calculation (оставляем) --------------------
function useLevel(totalClicks: number) {
  const getThreshold = (lvl: number) => (lvl <= 8 ? 200 * lvl - 100 : 300 * lvl - 900);
  let level = 1;
  while (getThreshold(level) <= totalClicks) level++;
  const prev = level === 1 ? 0 : getThreshold(level - 1);
  const next = getThreshold(level);
  const expInCurrent = totalClicks - prev;
  const expNeeded = next - prev;
  const percent = (expInCurrent / expNeeded) * 100;
  return { level, expInCurrent, expNeeded, percent };
}

// -------------------- Main App --------------------
function App() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [leaders, setLeaders] = useState<any[]>([]);

  // UI states
  const [showShop, setShowShop] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'profile' | 'leaders' | 'pets' | 'achievements'>('profile');
  const [prevProfileTab, setPrevProfileTab] = useState<'profile' | 'leaders' | 'pets' | 'achievements'>('profile');

  const [isClicking, setIsClicking] = useState(false);
  const [floaters, setFloaters] = useState<Array<{ id: number; value: number; x: number; y: number; emoji?: string }>>([]);
  const petRef = useRef<HTMLDivElement>(null);
  const [petName, setPetName] = useState<string>('Мой AI-питомец');
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(petName);
  const lastClickTime = useRef(0);
  const [gemsFlash, setGemsFlash] = useState(false);
  const [userAvatar, setUserAvatar] = useState('');
  const userId = tg?.initDataUnsafe?.user?.id || 'guest123';
  const inviteLink = `https://t.me/ваш_бот?start=ref_${userId}`;

  // Локальные бустеры (клиентские)
  const [boostActive, setBoostActive] = useState(false);
  const [boostTimeLeft, setBoostTimeLeft] = useState(0);
  const [gemBoostActive, setGemBoostActive] = useState(false);
  const [gemBoostTimeLeft, setGemBoostTimeLeft] = useState(0);
  const [costumeActive, setCostumeActive] = useState(false);
  const [costumeTimeLeft, setCostumeTimeLeft] = useState(0);
  const originalClickPowerRef = useRef(1);
  const [combo, setCombo] = useState(0);
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Toast
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }, []);

  // Загрузка данных
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) setUserAvatar(user.first_name?.charAt(0).toUpperCase() || '?');
    }
    api.init()
      .then(data => {
        setUserData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
    if (!localStorage.getItem('tutorialCompleted')) {
      setShowTutorial(true);
    }
  }, []);

  const fetchLeaders = useCallback(async () => {
    try {
      const data = await api.getLeaders();
      setLeaders(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Combo
  const resetCombo = useCallback(() => {
    setCombo(0);
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    comboTimeoutRef.current = null;
  }, []);
  const incrementCombo = useCallback(() => {
    setCombo(prev => prev + 1);
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    comboTimeoutRef.current = setTimeout(resetCombo, 2000);
  }, [resetCombo]);

  const closeAllModals = () => {
    setShowProfileMenu(false);
    setShowInviteMenu(false);
    setShowDailyBonus(false);
    setShowQuests(false);
    setShowInventory(false);
    setShowShop(false);
    setShowAchievements(false);
  };

  const handleOpenProfile = () => {
    closeAllModals();
    setShowProfileMenu(true);
  };

  const handleOpenInvite = () => {
    closeAllModals();
    setShowInviteMenu(true);
  };

  const handleOpenAchievements = () => {
    setPrevProfileTab(activeProfileTab);
    closeAllModals();
    setShowAchievements(true);
  };

  // Действия
  const handleClick = async () => {
    if (!userData) return;
    if (userData.stamina < 1) {
      showToast('Нет сил! Подожди, энергия восстановится.', 'error');
      vibrate([50, 100, 50]);
      return;
    }
    const now = Date.now();
    if (now - lastClickTime.current < 100) return;
    lastClickTime.current = now;

    incrementCombo();
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 300);

    try {
      const result = await api.click();
      setUserData((prev: any) => ({ ...prev, ...result }));
      setGemsFlash(true);
      setTimeout(() => setGemsFlash(false), 300);

      let gain = userData.click_power;
      if (gemBoostActive) gain *= 2;
      for (let i = 0; i < 3; i++) {
        const x = Math.random() * 200 + 25;
        const y = Math.random() * 150 + 15;
        const emoji = Math.random() > 0.5 ? '✨' : '💎';
        setFloaters(prev => [...prev, { id: Date.now() + Math.random(), value: gain, x, y, emoji }]);
      }
      vibrate(30);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleFeed = async () => {
    try {
      const result = await api.feed();
      setUserData((prev: any) => ({ ...prev, ...result }));
      showToast('Питомец накормлен! +10 энергии', 'success');
      vibrate(30);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePlay = async () => {
    try {
      const result = await api.play();
      setUserData((prev: any) => ({ ...prev, ...result }));
      setGemsFlash(true);
      setTimeout(() => setGemsFlash(false), 300);
      showToast(`Поиграли! +30 алмазов`, 'success');
      vibrate(50);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    showToast('✅ Ссылка скопирована!', 'success');
    // на сервер вызовется отдельно при регистрации, но здесь увеличиваем локально
    setUserData((prev: any) => ({ ...prev, friendsCount: prev.friendsCount + 1, gems: prev.gems + 1000 }));
    setGemsFlash(true);
    setTimeout(() => setGemsFlash(false), 300);
    vibrate(100);
  };

  const buyItem = async (item: InventoryItem, price: number) => {
    try {
      const result = await api.buyItem(item.id, price);
      setUserData((prev: any) => ({ ...prev, gems: result.gems, inventory: result.inventory }));
      showToast(`Куплено: ${item.name}`, 'success');
      vibrate(30);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const useItem = async (item: InventoryItem) => {
    try {
      const result = await api.useItem(item.id);
      setUserData((prev: any) => ({ ...prev, inventory: result.inventory, food: result.food }));
      // клиентские эффекты
      if (item.type === 'boost' && item.effect?.type === 'doubleClick') {
        if (boostActive) { showToast('Бустер уже активен!', 'error'); return; }
        setBoostActive(true);
        setBoostTimeLeft(item.effect.duration);
        originalClickPowerRef.current = userData.click_power;
        setUserData((prev: any) => ({ ...prev, click_power: prev.click_power * 2 }));
        const interval = setInterval(() => {
          setBoostTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              setBoostActive(false);
              setUserData((prev2: any) => ({ ...prev2, click_power: originalClickPowerRef.current }));
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        showToast('Бустер кликов активирован!', 'success');
      } else if (item.type === 'goldenTicket' && item.effect?.type === 'doubleGems') {
        if (gemBoostActive) { showToast('Бустер алмазов уже активен!', 'error'); return; }
        setGemBoostActive(true);
        setGemBoostTimeLeft(item.effect.duration);
        const interval = setInterval(() => {
          setGemBoostTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              setGemBoostActive(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        showToast('Бустер алмазов активирован!', 'success');
      } else if (item.type === 'skin') {
        if (costumeActive) { showToast('Костюм уже надет!', 'error'); return; }
        setCostumeActive(true);
        setCostumeTimeLeft(3600);
        const interval = setInterval(() => {
          setCostumeTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              setCostumeActive(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        showToast('Костюм надет!', 'success');
      }
      vibrate(30);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const claimDaily = async () => {
    try {
      const result = await api.claimDaily();
      setUserData((prev: any) => ({ ...prev, gems: result.gems, daily_streak: result.streak }));
      setGemsFlash(true);
      setTimeout(() => setGemsFlash(false), 300);
      showToast(`Ежедневный бонус получен!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const claimQuest = async (id: string) => {
    try {
      const result = await api.claimQuest(id);
      setUserData((prev: any) => ({ ...prev, gems: result.gems, quests: result.quests }));
      setGemsFlash(true);
      setTimeout(() => setGemsFlash(false), 300);
      showToast(`Награда за задание получена!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const upgradePet = async (petId: string) => {
    try {
      const result = await api.upgradePet(petId);
      setUserData((prev: any) => ({ ...prev, gems: result.gems, petLevels: result.petLevels }));
      showToast('Питомец улучшен!', 'success');
      vibrate(100);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const selectPet = async (id: string) => {
    try {
      const result = await api.selectPet(id);
      setUserData((prev: any) => ({ ...prev, selectedPetId: result.selectedPetId }));
      localStorage.setItem('selectedPet', id);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const buyClickUpgrade = async () => {
    try {
      const result = await api.buyClickUpgrade();
      setUserData((prev: any) => ({ ...prev, ...result }));
      showToast('Улучшение куплено!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const buyRegenUpgrade = async () => {
    try {
      const result = await api.buyRegenUpgrade();
      setUserData((prev: any) => ({ ...prev, ...result }));
      showToast('Улучшение куплено!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const buyMaxStaminaUpgrade = async () => {
    try {
      const result = await api.buyMaxStaminaUpgrade();
      setUserData((prev: any) => ({ ...prev, ...result }));
      showToast('Улучшение куплено!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // После всех хуков идёт рендер, который будет в Части 2
  // (здесь продолжение)


  // -------------------- Рендер компонента App --------------------
  if (loading) return <div style={styles.loadingContainer}>Загружаем питомца...</div>;
  if (!userData) return <div style={styles.loadingContainer}>Ошибка загрузки</div>;

  const { level, expInCurrent, expNeeded, percent } = useLevel(userData.total_clicks || 0);

  return (
    <div style={styles.container}>
      {/* Event Banner (заглушка) */}
      {/*{specialEvent?.active && (*/}
      {/*  <div style={styles.eventBanner}>*/}
      {/*    {specialEvent.type === 'rarePet' && '✨ Редкий питомец временно доступен! ✨'}*/}
      {/*    {specialEvent.type === 'doubleRewards' && '✨ Удвоенные награды! ✨'}*/}
      {/*    {specialEvent.type === 'boss' && '✨ Босс! Атакуй! ✨'}*/}
      {/*    <span> До окончания: {Math.ceil((specialEvent.expiresAt - Date.now()) / 60000)} мин</span>*/}
      {/*  </div>*/}
      {/*)}*/}

      <Header
        userAvatar={userAvatar}
        friendsCount={userData.friendsCount || 0}
        onAvatarClick={handleOpenProfile}
        onInviteClick={handleOpenInvite}
        petName={petName}
        isEditing={isEditing}
        tempName={tempName}
        setTempName={setTempName}
        onNameClick={() => setIsEditing(true)}
        onNameSave={() => { if (tempName.trim()) setPetName(tempName); setIsEditing(false); }}
        onNameCancel={() => setIsEditing(false)}
      />

      <div style={styles.scrollableContent}>
        <StatsBars
          food={userData.food}
          maxFood={MAX_FOOD}
          level={level}
          expInCurrent={expInCurrent}
          expNeeded={expNeeded}
          expPercent={percent}
          gems={userData.gems}
          clickPower={userData.click_power}
          gemsFlash={gemsFlash}
        />

        <Pet
          ref={petRef}
          emoji={costumeActive ? '🦸' : PETS.find(p => p.id === userData.selectedPetId)?.emoji || '🐶'}
          isClicking={isClicking}
          onClick={handleClick}
          floaters={floaters}
        />

        <div style={styles.energyWrapper}>
          <div style={styles.barLabel}>⚡ Энергия (+{userData.stamina_regen_rate.toFixed(1)}/сек)</div>
          <div style={styles.barBg}>
            <div style={{ ...styles.barFill, width: `${(userData.stamina / userData.max_stamina) * 100}%`, background: '#ffcc00' }} />
            <span style={styles.barText}>{userData.stamina}/{userData.max_stamina}</span>
          </div>
          {boostActive && <div style={styles.boostIndicator}>🚀 Бустер кликов: {boostTimeLeft}с</div>}
          {gemBoostActive && <div style={styles.boostIndicator}>💎 Бустер алмазов: {gemBoostTimeLeft}с</div>}
          {costumeActive && <div style={styles.boostIndicator}>🦸 Костюм: {Math.floor(costumeTimeLeft/60)}м {costumeTimeLeft%60}с</div>}
        </div>
      </div>

      <ActionButtons
        onFeed={handleFeed}
        onPlay={handlePlay}
        onShop={() => { closeAllModals(); setShowShop(true); }}
        onDaily={() => { closeAllModals(); setShowDailyBonus(true); }}
        onQuests={() => { closeAllModals(); setShowQuests(true); }}
        onInventory={() => { closeAllModals(); setShowInventory(true); }}
        onAchievements={handleOpenAchievements}
      />

      {showDailyBonus && (
        <DailyBonusModal
          daily={{ streak: userData.daily_streak || 0, claimedToday: false }}
          onClaim={claimDaily}
          onClose={() => setShowDailyBonus(false)}
        />
      )}

      {showQuests && (
        <QuestsModal
          quests={userData.quests || []}
          onClaim={claimQuest}
          onClose={() => setShowQuests(false)}
        />
      )}

      {showInventory && (
        <InventoryModal
          inventory={userData.inventory || []}
          onUse={useItem}
          onClose={() => setShowInventory(false)}
        />
      )}

      {showShop && (
        <ShopModal
          gems={userData.gems}
          clickUpgradeLevel={userData.click_upgrade_level}
          regenUpgradeLevel={userData.regen_upgrade_level}
          maxStaminaUpgradeLevel={userData.max_stamina_upgrade_level}
          clickPower={userData.click_power}
          staminaRegenRate={userData.stamina_regen_rate}
          maxStamina={userData.max_stamina}
          foodPurchasesToday={0}
          maxFoodPurchases={MAX_FOOD_PURCHASES_PER_DAY}
          onBuyClickUpgrade={buyClickUpgrade}
          onBuyRegenUpgrade={buyRegenUpgrade}
          onBuyMaxStaminaUpgrade={buyMaxStaminaUpgrade}
          onBuyItem={buyItem}
          shopItems={SHOP_ITEMS}
          onClose={() => setShowShop(false)}
        />
      )}

      {showInviteMenu && (
        <InviteModal
          inviteLink={inviteLink}
          onCopy={copyInviteLink}
          onClose={() => {
            setShowInviteMenu(false);
            setShowProfileMenu(true);
          }}
        />
      )}

      {showProfileMenu && (
        <ProfileModal
          activeTab={activeProfileTab}
          setActiveTab={setActiveProfileTab}
          userAvatar={userAvatar}
          user={tg?.initDataUnsafe?.user}
          friendsCount={userData.friendsCount || 0}
          totalClicks={userData.total_clicks}
          level={level}
          gems={userData.gems}
          daysInGame={userData.days_in_game || 1}
          onInvite={handleOpenInvite}
          onAchievements={handleOpenAchievements}
          leaders={leaders}
          onOpenLeaders={fetchLeaders}
          pets={PETS}
          isPetUnlocked={(pet: Pet) => {
            // Простейшая проверка (можно реализовать полноценно позже)
            if (pet.unlock === 'start') return true;
            if (pet.unlock === 'level' && pet.level && level >= pet.level) return true;
            if (pet.unlock === 'invite' && pet.invites && userData.friendsCount >= pet.invites) return true;
            if (pet.unlock === 'event') return false; // ивент пока не реализован
            return false;
          }}
          selectedPetId={userData.selectedPetId}
          onSelectPet={selectPet}
          petLevels={userData.petLevels || {}}
          onUpgradePet={upgradePet}
          onClose={() => setShowProfileMenu(false)}
        />
      )}

      {showAchievements && (
        <AchievementsModal
          achievements={[]} // нужно добавить с сервера
          onClose={() => {
            setShowAchievements(false);
            setShowProfileMenu(true);
            setActiveProfileTab(prevProfileTab);
          }}
        />
      )}

      {showTutorial && (
        <Tutorial
          onComplete={() => {
            setShowTutorial(false);
            localStorage.setItem('tutorialCompleted', 'true');
          }}
        />
      )}

      <div style={styles.toastContainer}>
        {toasts.map(toast => (
          <div key={toast.id} style={{ ...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastInfo) }}>
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------- Component Definitions --------------------

interface HeaderProps {
  userAvatar: string;
  friendsCount: number;
  onAvatarClick: () => void;
  onInviteClick: () => void;
  petName: string;
  isEditing: boolean;
  tempName: string;
  setTempName: (name: string) => void;
  onNameClick: () => void;
  onNameSave: () => void;
  onNameCancel: () => void;
}

const Header: React.FC<HeaderProps> = ({
  userAvatar, friendsCount, onAvatarClick, onInviteClick,
  petName, isEditing, tempName, setTempName, onNameClick, onNameSave, onNameCancel
}) => (
  <div style={styles.header}>
    <div style={styles.profile}>
      <div style={styles.avatar} onClick={onAvatarClick}>{userAvatar}</div>
      <div style={styles.friendsBadge} onClick={onInviteClick}>👥 {friendsCount}</div>
    </div>
    {isEditing ? (
      <div style={styles.nameEditor}>
        <input type="text" value={tempName} onChange={e => setTempName(e.target.value)} style={styles.nameInput} autoFocus />
        <button onClick={onNameSave} style={styles.nameSaveBtn}>✅</button>
        <button onClick={onNameCancel} style={styles.nameCancelBtn}>❌</button>
      </div>
    ) : (
      <div style={styles.nameDisplay} onClick={onNameClick}>
        <span style={styles.petName}>{petName}</span>
        <span style={styles.editIcon}>✏️</span>
      </div>
    )}
  </div>
);

interface StatsBarsProps {
  food: number;
  maxFood: number;
  level: number;
  expInCurrent: number;
  expNeeded: number;
  expPercent: number;
  gems: number;
  clickPower: number;
  gemsFlash?: boolean;
}

const StatsBars: React.FC<StatsBarsProps> = ({
  food, maxFood, level, expInCurrent, expNeeded, expPercent, gems, clickPower, gemsFlash
}) => (
  <>
    <div style={styles.stats}>
      <div style={styles.statCard}>
        <span style={styles.statValue}>{level}</span>
        <span style={styles.statLabel}>📈 Уровень</span>
      </div>
      <div style={styles.statCard}>
        <span style={styles.statValue}>{food}</span>
        <span style={styles.statLabel}>🍖 Еда</span>
      </div>
      <div style={{...styles.statCard, animation: gemsFlash ? 'flash 0.3s ease-out' : 'none'}}>
        <span style={styles.statValue}>{gems.toFixed(1)}</span>
        <span style={styles.statLabel}>💎 Алмазы</span>
      </div>
      <div style={styles.statCard}>
        <span style={styles.statValue}>{clickPower.toFixed(1)}</span>
        <span style={styles.statLabel}>💥 Сила клика</span>
      </div>
    </div>
    <div style={styles.barWrapper}>
      <div style={styles.barLabel}>🦴 Голод</div>
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${(food / maxFood) * 100}%`, background: '#ff9216' }} />
        <span style={styles.barText}>{food}/{maxFood}</span>
      </div>
    </div>
    <div style={styles.barWrapper}>
      <div style={styles.barLabel}>📈 Опыт до след. уровня</div>
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${expPercent}%`, background: '#0285ff' }} />
        <span style={styles.barText}>{expInCurrent}/{expNeeded}</span>
      </div>
    </div>
  </>
);

interface PetProps {
  emoji: string;
  isClicking: boolean;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  floaters: Array<{ id: number; value: number; x: number; y: number; emoji?: string }>;
}

const Pet = React.forwardRef<HTMLDivElement, PetProps>(({ emoji, isClicking, onClick, floaters }, ref) => (
  <div style={styles.petContainer}>
    <div
      ref={ref}
      style={{
        ...styles.petCircle,
        animation: isClicking ? 'pulse 0.3s ease-out, shake 0.3s ease-out' : 'none',
        transform: isClicking ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.2s, box-shadow 0.3s',
      }}
      onClick={onClick}
    >
      <div style={{ fontSize: '150px' }}>
        {emoji}
      </div>
      {floaters.map((f) => (
        <div key={f.id} style={{ position: 'absolute', left: f.x, top: f.y, color: '#ffd700', fontWeight: 'bold', fontSize: '20px', pointerEvents: 'none', animation: 'floatUp 1s ease-out forwards' }}>
          {f.emoji || '+' + f.value.toFixed(1)}
        </div>
      ))}
      {isClicking && <div style={styles.clickFlash} />}
    </div>
  </div>
));

interface ActionButtonsProps {
  onFeed: () => void;
  onPlay: () => void;
  onShop: () => void;
  onDaily: () => void;
  onQuests: () => void;
  onInventory: () => void;
  onAchievements: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onFeed, onPlay, onShop, onDaily, onQuests, onInventory, onAchievements }) => (
  <div style={styles.buttonsContainer}>
    <div style={styles.actionsRow}>
      <button style={{ ...styles.button, ...styles.feedButton }} onClick={onFeed}>🍖 Покормить</button>
      <button style={{ ...styles.button, ...styles.playButton }} onClick={onPlay}>🎾 Поиграть</button>
      <button style={{ ...styles.button, ...styles.shopButton }} onClick={onDaily}>🎁 Бонус</button>
    </div>
    <div style={styles.actionsRow}>
      <button style={{ ...styles.button, ...styles.shopButton }} onClick={onQuests}>📋 Задания</button>
      <button style={{ ...styles.button, ...styles.shopButton }} onClick={onInventory}>🎒 Инвентарь</button>
      <button style={{ ...styles.button, ...styles.shopButton }} onClick={onAchievements}>🏆 Достижения</button>
      <button style={{ ...styles.button, ...styles.shopButton }} onClick={onShop}>🛒 Магазин</button>
    </div>
  </div>
);

interface DailyBonusModalProps {
  daily: { streak: number; claimedToday: boolean };
  onClaim: () => void;
  onClose: () => void;
}

const DailyBonusModal: React.FC<DailyBonusModalProps> = ({ daily, onClaim, onClose }) => (
  <div style={styles.modalOverlay} onClick={onClose}>
    <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><h3 style={styles.modalTitle}>🎁 Ежедневный бонус</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
      <div>Текущая серия: {daily.streak} дней</div>
      {!daily.claimedToday ? (
        <button onClick={() => { onClaim(); onClose(); }} style={styles.referralButton}>Забрать {50 + daily.streak * 10} 💎</button>
      ) : (
        <p>Уже забрали сегодня. Приходите завтра!</p>
      )}
    </div>
  </div>
);

interface QuestsModalProps {
  quests: Quest[];
  onClaim: (id: string) => void;
  onClose: () => void;
}

const QuestsModal: React.FC<QuestsModalProps> = ({ quests, onClaim, onClose }) => (
  <div style={styles.modalOverlay} onClick={onClose}>
    <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><h3 style={styles.modalTitle}>📋 Задания</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
      {quests.map((q) => (
        <div key={q.id} style={styles.questItem}>
          <div><strong>{q.title}</strong> ({q.progress}/{q.target})</div>
          <div>{q.description}</div>
          {!q.completed && q.progress >= q.target ? (
            <button onClick={() => onClaim(q.id)} style={styles.referralButton}>Забрать {q.reward} 💎</button>
          ) : q.completed ? <span>✅ Выполнено</span> : <progress value={q.progress} max={q.target} />}
        </div>
      ))}
    </div>
  </div>
);

interface InventoryModalProps {
  inventory: InventoryItem[];
  onUse: (item: InventoryItem) => void;
  onClose: () => void;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ inventory, onUse, onClose }) => (
  <div style={styles.modalOverlay} onClick={onClose}>
    <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><h3 style={styles.modalTitle}>🎒 Инвентарь</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
      {inventory.map((item) => item.quantity > 0 && (
        <div key={item.id} style={styles.shopItem}>
          <span>{item.emoji} {item.name} x{item.quantity}</span>
          <button onClick={() => onUse(item)} style={styles.referralButton}>Использовать</button>
        </div>
      ))}
    </div>
  </div>
);

interface ShopModalProps {
  gems: number;
  clickUpgradeLevel: number;
  regenUpgradeLevel: number;
  maxStaminaUpgradeLevel: number;
  clickPower: number;
  staminaRegenRate: number;
  maxStamina: number;
  foodPurchasesToday: number;
  maxFoodPurchases: number;
  onBuyClickUpgrade: () => void;
  onBuyRegenUpgrade: () => void;
  onBuyMaxStaminaUpgrade: () => void;
  onBuyItem: (item: InventoryItem, price: number) => void;
  shopItems: InventoryItem[];
  onClose: () => void;
}

const ShopModal: React.FC<ShopModalProps> = ({
  gems, clickUpgradeLevel, regenUpgradeLevel, maxStaminaUpgradeLevel,
  clickPower, staminaRegenRate, maxStamina, foodPurchasesToday, maxFoodPurchases,
  onBuyClickUpgrade, onBuyRegenUpgrade, onBuyMaxStaminaUpgrade,
  onBuyItem, shopItems, onClose
}) => (
  <div style={styles.modalOverlay} onClick={onClose}>
    <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><h3 style={styles.modalTitle}>🛒 Магазин</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
      <div>У вас 💎 {gems.toFixed(1)}</div>
      <div style={styles.shopSection}>
        <h4>⚡ Сила клика</h4>
        <div style={styles.shopItem} onClick={onBuyClickUpgrade}>
          <span>Улучшить клик (сейчас {clickPower.toFixed(1)} → {(clickPower+0.2).toFixed(1)})</span>
          <span>{10 + clickUpgradeLevel * 5} 💎</span>
        </div>
      </div>
      <div style={styles.shopSection}>
        <h4>💪 Энергия</h4>
        <div style={styles.shopItem} onClick={onBuyRegenUpgrade}>
          <span>Скорость регенерации (сейчас +{staminaRegenRate.toFixed(1)} → +{(staminaRegenRate+0.5).toFixed(1)})</span>
          <span>{15 + regenUpgradeLevel * 8} 💎</span>
        </div>
        <div style={styles.shopItem} onClick={onBuyMaxStaminaUpgrade}>
          <span>Макс. энергия (сейчас {maxStamina} → {maxStamina+20})</span>
          <span>{30 + maxStaminaUpgradeLevel * 10} 💎</span>
        </div>
      </div>
      <div style={styles.shopSection}>
        <h4>🎁 Предметы</h4>
        {shopItems.map((item) => {
          let price = 50;
          if (item.id === 'food_bag') price = 40;
          if (item.id === 'golden_ticket') price = 80;
          if (item.id === 'costume') price = 100;
          return (
            <div key={item.id} style={styles.shopItem} onClick={() => onBuyItem(item, price)}>
              <span>{item.emoji} {item.name} - {item.description}</span>
              <span>{price} 💎 {item.id === 'food_bag' && ` (${foodPurchasesToday}/${maxFoodPurchases})`}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

interface InviteModalProps {
  inviteLink: string;
  onCopy: () => void;
  onClose: () => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ inviteLink, onCopy, onClose }) => (
  <div style={styles.modalOverlay} onClick={onClose}>
    <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><h3 style={styles.modalTitle}>👥 Пригласить друга</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
      <p>За каждого друга ты получишь 1000 💎 после его первого клика.</p>
      <div style={styles.inviteLinkContainer}>
        <input type="text" value={inviteLink} readOnly style={styles.inviteLinkInput} />
        <button onClick={onCopy} style={styles.copyButton}>📋</button>
      </div>
    </div>
  </div>
);

interface ProfileModalProps {
  activeTab: 'profile' | 'leaders' | 'pets' | 'achievements';
  setActiveTab: (tab: 'profile' | 'leaders' | 'pets' | 'achievements') => void;
  userAvatar: string;
  user?: any;
  friendsCount: number;
  totalClicks: number;
  level: number;
  gems: number;
  daysInGame: number;
  onInvite: () => void;
  onAchievements: () => void;
  leaders: any[];
  onOpenLeaders: () => void;
  pets: Pet[];
  isPetUnlocked: (pet: Pet) => boolean;
  selectedPetId: string;
  onSelectPet: (id: string) => void;
  petLevels: Record<string, number>;
  onUpgradePet: (petId: string) => void;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  activeTab, setActiveTab, userAvatar, user, friendsCount, totalClicks, level, gems,
  daysInGame, onInvite, onAchievements, leaders, onOpenLeaders, pets, isPetUnlocked, selectedPetId, onSelectPet, petLevels, onUpgradePet, onClose
}) => {
  useEffect(() => {
    if (activeTab === 'leaders') {
      onOpenLeaders();
    }
  }, [activeTab, onOpenLeaders]);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Мой профиль</h3>
          <button style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <div style={styles.tabs}>
          <button style={{ ...styles.tabButton, ...(activeTab === 'profile' ? styles.activeTab : {}) }} onClick={() => setActiveTab('profile')}>Профиль</button>
          <button style={{ ...styles.tabButton, ...(activeTab === 'leaders' ? styles.activeTab : {}) }} onClick={() => setActiveTab('leaders')}>Лидеры</button>
          <button style={{ ...styles.tabButton, ...(activeTab === 'pets' ? styles.activeTab : {}) }} onClick={() => setActiveTab('pets')}>Питомцы</button>
          <button style={{ ...styles.tabButton, ...(activeTab === 'achievements' ? styles.activeTab : {}) }} onClick={() => { setActiveTab('achievements'); onAchievements(); }}>🏆</button>
        </div>

        {activeTab === 'profile' && (
          <div style={styles.profileContent}>
            <div style={styles.profileHeader}>
              <div style={styles.profileAvatarLarge}>{userAvatar}</div>
              <div style={styles.profileNames}>
                <div style={styles.profileName}>{user?.first_name || 'Игрок'}</div>
                <div style={styles.profileUsername}>@{user?.username || 'username'}</div>
                <div style={styles.profileDays}>📅 В игре {daysInGame} дн.</div>
              </div>
            </div>

            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <span style={styles.statBoxValue}>{friendsCount}</span>
                <span style={styles.statBoxLabel}>Друзья</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statBoxValue}>{totalClicks}</span>
                <span style={styles.statBoxLabel}>Клики</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statBoxValue}>{level}</span>
                <span style={styles.statBoxLabel}>Уровень</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statBoxValue}>{gems.toFixed(1)}</span>
                <span style={styles.statBoxLabel}>Алмазы</span>
              </div>
            </div>

            <button onClick={onInvite} style={styles.inviteButton}>
              👥 Пригласить друга (1000💎)
            </button>
          </div>
        )}

        {activeTab === 'leaders' && (
          <div style={styles.leadersList}>
            {leaders.map((player, index) => (
              <div key={index} style={styles.leaderItem}>
                <span style={styles.leaderPosition}>{index + 1}</span>
                <span style={styles.leaderName}>{player.name}</span>
                <span style={styles.leaderScore}>{player.score.toFixed(1)} 💎</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'pets' && (
          <div style={styles.petsList}>
            {pets.map((pet) => {
              const unlocked = isPetUnlocked(pet);
              const isSelected = selectedPetId === pet.id;
              const level = petLevels[pet.id] || 1;
              return (
                <div
                  key={pet.id}
                  style={{ ...styles.petItem, ...(isSelected ? styles.petItemSelected : {}), ...(!unlocked ? styles.petItemLocked : {}) }}
                  onClick={() => unlocked && onSelectPet(pet.id)}
                >
                  <span style={styles.petItemEmoji}>{pet.emoji}</span>
                  <div style={styles.petItemInfo}>
                    <div style={styles.petItemName}>{pet.name} (ур. {level}/{pet.maxLevel || 5})</div>
                    {!unlocked && (
                      <div style={styles.petItemCondition}>
                        🔒 {pet.unlock === 'level' && `нужен ${pet.level} уровень`}
                        {pet.unlock === 'invite' && `нужно ${pet.invites} друзей`}
                        {pet.unlock === 'event' && 'доступен во время ивента'}
                      </div>
                    )}
                  </div>
                  {unlocked && isSelected && <span style={styles.petItemSelectedMark}>✓</span>}
                  {unlocked && level < (pet.maxLevel || 5) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpgradePet(pet.id); }}
                      style={styles.upgradeButton}
                    >
                      ⬆️ {pet.upgradeCost ? pet.upgradeCost(level) : 30}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div>Переход к достижениям...</div>
        )}
      </div>
    </div>
  );
};

interface AchievementsModalProps {
  achievements: any[];
  onClose: () => void;
}

const AchievementsModal: React.FC<AchievementsModalProps> = ({ achievements, onClose }) => (
  <div style={styles.modalOverlay} onClick={onClose}>
    <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}>
        <h3 style={styles.modalTitle}>🏆 Достижения</h3>
        <button style={styles.closeButton} onClick={onClose}>✕</button>
      </div>
      <div style={styles.achievementsList}>
        {achievements.map(ach => (
          <div key={ach.id} style={{...styles.achievementItem, opacity: ach.completed ? 1 : 0.6}}>
            <span style={styles.achievementIcon}>{ach.icon}</span>
            <div style={styles.achievementInfo}>
              <div style={styles.achievementTitle}>{ach.title}</div>
              <div style={styles.achievementDesc}>{ach.description}</div>
              {ach.completed && <span style={styles.achievementReward}>+{ach.reward} 💎</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

interface TutorialProps {
  onComplete: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const steps = [
    'Кликай на питомца, чтобы зарабатывать алмазы!',
    'Корми питомца, чтобы восстановить энергию.',
    'Играй с питомцем, чтобы получить больше алмазов.',
    'Заходи в магазин, чтобы улучшать характеристики.',
    'Приглашай друзей и получай бонусы!',
    'Открывай достижения за особые успехи!',
  ];
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.tutorialBox}>
        <h3>Обучение</h3>
        <p>{steps[step]}</p>
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)} style={styles.referralButton}>Далее</button>
        ) : (
          <button onClick={onComplete} style={styles.referralButton}>Завершить</button>
        )}
      </div>
    </div>
  );
};

// -------------------- Styles --------------------
const styles: Record<string, React.CSSProperties> = {
  container: { 
    height: '100vh',
    background: 'linear-gradient(145deg, #0f1215 0%, #1a1e2a 100%)',
    color: '#fff', 
    padding: '12px', 
    fontFamily: 'sans-serif', 
    display: 'flex', 
    flexDirection: 'column' as const, 
    boxSizing: 'border-box' as const, 
    position: 'relative' as const,
  },
  loadingContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  profile: { display: 'flex', alignItems: 'center', gap: '6px' },
  avatar: { width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffcc00, #ff8800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', border: '2px solid rgba(255,255,255,0.3)', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' },
  friendsBadge: { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(5px)', borderRadius: '20px', padding: '4px 8px', fontSize: '13px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: '4px' },
  nameDisplay: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
  petName: { fontSize: '18px', fontWeight: 'bold', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
  editIcon: { fontSize: '14px', opacity: 0.7 },
  nameEditor: { display: 'flex', alignItems: 'center', gap: '4px' },
  nameInput: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '14px', outline: 'none' },
  nameSaveBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' },
  nameCancelBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' },
  scrollableContent: {
    flex: 1,
    overflowY: 'auto' as const,
    marginBottom: '8px',
    paddingRight: '2px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px', marginBottom: '8px' },
  statCard: {
    background: 'rgba(30, 35, 45, 0.7)',
    backdropFilter: 'blur(8px)',
    borderRadius: '12px',
    padding: '8px 2px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
  },
  statValue: { fontSize: '15px', fontWeight: 'bold', color: '#ffcc00', textShadow: '0 0 8px rgba(255,204,0,0.5)' },
  statLabel: { fontSize: '9px', color: '#aaa', marginTop: '2px' },
  barWrapper: { marginBottom: '8px' },
  barLabel: { fontSize: '12px', fontWeight: 'bold', color: '#fff', marginBottom: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
  barBg: { background: 'rgba(20,20,30,0.7)', backdropFilter: 'blur(4px)', height: '16px', borderRadius: '8px', position: 'relative' as const, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' },
  barFill: { height: '100%', borderRadius: '8px', transition: 'width 0.3s ease', boxShadow: '0 0 8px currentColor' },
  barText: { position: 'absolute' as const, top: 0, left: 0, width: '100%', textAlign: 'center' as const, lineHeight: '16px', fontSize: '10px', color: '#fff', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.8)' },
  petContainer: { position: 'relative' as const, margin: '30px auto 20px', width: 'fit-content' },
  petCircle: {
    position: 'relative' as const,
    width: '200px',
    height: '180px',
    background: 'radial-gradient(circle at 30% 30%, #3a3f4a, #1e2228)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '3px solid rgba(255,204,0,0.3)',
    overflow: 'hidden',
    transition: 'box-shadow 0.3s, transform 0.2s',
    boxShadow: '0 20px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,204,0,0.2)',
  },
  clickFlash: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,204,0,0.8) 0%, rgba(255,204,0,0) 70%)',
    animation: 'fadeOut 0.3s ease-out forwards',
    pointerEvents: 'none' as const,
  },
  energyWrapper: { marginTop: '10px', marginBottom: '8px' },
  boostIndicator: {
    marginTop: '6px',
    fontSize: '11px',
    color: '#00aaff',
    textAlign: 'center' as const,
    background: 'rgba(0,0,0,0.3)',
    padding: '4px 8px',
    borderRadius: '20px',
    backdropFilter: 'blur(4px)',
    display: 'inline-block',
    width: 'fit-content',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  buttonsContainer: { marginTop: '0px' },
  actionsRow: { display: 'flex', gap: '6px', marginBottom: '6px' },
  button: { flex: 1, padding: '10px', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', touchAction: 'manipulation', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', background: 'linear-gradient(145deg, #ffcc00, #ffaa00)', color: '#000', textShadow: '0 1px 2px rgba(255,255,255,0.3)' },
  feedButton: { background: 'linear-gradient(145deg, #ff9216, #e07b00)', color: '#fff' },
  playButton: { background: 'linear-gradient(145deg, #0285ff, #0066cc)', color: '#fff' },
  shopButton: { background: 'linear-gradient(145deg, #666, #444)', color: '#fff' },
  modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: 'linear-gradient(145deg, #1a1e2a, #0f1215)', borderRadius: '24px', width: '90%', maxWidth: '350px', padding: '14px', border: '1px solid rgba(255,204,0,0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', transformOrigin: 'top', animation: 'slideIn 0.3s ease' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  modalTitle: { fontSize: '16px', fontWeight: 'bold', color: '#ffcc00', margin: 0 },
  closeButton: { background: 'none', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer' },
  tabs: { display: 'flex', marginBottom: '10px', borderBottom: '1px solid #444' },
  tabButton: { flex: 1, background: 'none', border: 'none', color: '#fff', padding: '6px', cursor: 'pointer', fontSize: '13px', borderBottom: '2px solid transparent' },
  activeTab: { borderBottom: '2px solid #ffcc00', color: '#ffcc00' },
  profileContent: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  profileHeader: { display: 'flex', gap: '10px', alignItems: 'center' },
  profileAvatarLarge: { width: '50px', height: '50px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffcc00, #ff8800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', border: '2px solid #ffcc00', boxShadow: '0 0 20px rgba(255,204,0,0.5)' },
  profileNames: { display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  profileName: { fontSize: '16px', fontWeight: 'bold', color: '#ffcc00' },
  profileUsername: { fontSize: '11px', color: '#aaa' },
  profileDays: { fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '6px' },
  statBox: { background: 'rgba(30,35,45,0.7)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' },
  statBoxValue: { fontSize: '18px', fontWeight: 'bold', color: '#ffcc00' },
  statBoxLabel: { fontSize: '10px', color: '#aaa', marginTop: '2px' },
  inviteButton: { background: 'linear-gradient(145deg, #ffcc00, #ffaa00)', color: '#000', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', width: '100%', marginTop: '6px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' },
  leadersList: { display: 'flex', flexDirection: 'column' as const, gap: '8px', maxHeight: '300px', overflowY: 'auto' as const },
  leaderItem: { display: 'flex', alignItems: 'center', padding: '8px', borderBottom: '1px solid #333' },
  leaderPosition: { width: '30px', fontWeight: 'bold', color: '#ffcc00' },
  leaderName: { flex: 1, marginLeft: '10px' },
  leaderScore: { fontWeight: 'bold', color: '#ffcc00' },
  petsList: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  petItem: { display: 'flex', alignItems: 'center', background: 'rgba(30,35,45,0.7)', borderRadius: '6px', padding: '6px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' },
  petItemSelected: { border: '2px solid #ffcc00' },
  petItemLocked: { opacity: 0.5, cursor: 'not-allowed' },
  petItemEmoji: { fontSize: '24px', marginRight: '8px' },
  petItemInfo: { flex: 1 },
  petItemName: { fontSize: '12px', fontWeight: 'bold' },
  petItemCondition: { fontSize: '9px', color: '#aaa' },
  petItemSelectedMark: { color: '#ffcc00', fontWeight: 'bold', fontSize: '14px', marginLeft: '4px' },
  upgradeButton: { marginLeft: '4px', background: '#ffcc00', border: 'none', borderRadius: '4px', padding: '3px 5px', cursor: 'pointer', fontSize: '10px' },
  referralButton: { background: 'linear-gradient(145deg, #666, #444)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px', fontSize: '11px', cursor: 'pointer', width: '100%', marginTop: '6px' },
  eventBanner: { background: 'linear-gradient(90deg, #ffcc00, #ffaa00)', color: '#000', padding: '6px', textAlign: 'center' as const, borderRadius: '6px', marginBottom: '6px', fontWeight: 'bold', fontSize: '11px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' },
  inviteLinkContainer: { display: 'flex', gap: '4px', marginBottom: '6px' },
  inviteLinkInput: { flex: 1, background: 'rgba(30,35,45,0.7)', border: '1px solid #444', borderRadius: '4px', padding: '5px', color: '#fff', fontSize: '10px', outline: 'none' },
  copyButton: { background: '#444', border: 'none', borderRadius: '4px', padding: '5px 8px', color: '#fff', cursor: 'pointer', fontSize: '12px' },
  shopSection: { marginBottom: '12px' },
  shopItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30,35,45,0.7)', padding: '8px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' },
  questItem: { background: 'rgba(30,35,45,0.7)', padding: '6px', borderRadius: '6px', marginBottom: '4px', fontSize: '11px' },
  tutorialBox: { background: '#111', padding: '20px', borderRadius: '16px', textAlign: 'center' as const, maxWidth: '250px' },
  toastContainer: { position: 'fixed' as const, top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000, display: 'flex', flexDirection: 'column' as const, gap: '8px', alignItems: 'center', pointerEvents: 'none' },
  toast: { padding: '8px 16px', borderRadius: '30px', fontSize: '13px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', animation: 'slideDown 0.3s ease' },
  toastSuccess: { background: 'rgba(0,200,100,0.9)', color: '#fff' },
  toastError: { background: 'rgba(255,50,50,0.9)', color: '#fff' },
  toastInfo: { background: 'rgba(50,150,255,0.9)', color: '#fff' },
  achievementsList: { display: 'flex', flexDirection: 'column' as const, gap: '8px', maxHeight: '300px', overflowY: 'auto' as const },
  achievementItem: { display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(30,35,45,0.7)', padding: '8px', borderRadius: '8px' },
  achievementIcon: { fontSize: '24px' },
  achievementInfo: { flex: 1 },
  achievementTitle: { fontSize: '14px', fontWeight: 'bold', color: '#ffcc00' },
  achievementDesc: { fontSize: '10px', color: '#aaa' },
  achievementReward: { fontSize: '10px', color: '#0f0', marginLeft: '4px' },
};

// Global animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
@keyframes floatUp {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-50px); }
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-50px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255,204,0,0.7); }
  70% { box-shadow: 0 0 0 20px rgba(255,204,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,204,0,0); }
}
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
@keyframes flash {
  0%, 100% { background-color: rgba(255,204,0,0); }
  50% { background-color: rgba(255,204,0,0.3); }
}`;
document.head.appendChild(styleSheet);

export default App;
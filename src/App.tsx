import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

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

interface Achievement {
  id: string;
  title: string;
  description: string;
  condition: (state: any) => boolean;
  reward: number;
  icon: string;
  completed: boolean;
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

const INITIAL_PET_LEVELS: Record<string, number> = { dog: 1, cat: 1, rabbit: 1 };

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
  { id: 'q4', title: 'Пригласи друга', description: 'Пригласи 1 друга', target: 1, progress: 0, reward: 100, completed: false, type: 'invite' },
  { id: 'q5', title: 'Улучшай!', description: 'Купи 1 улучшение в магазине', target: 1, progress: 0, reward: 60, completed: false, type: 'upgrade' },
];

const SHOP_ITEMS: InventoryItem[] = [
  { id: 'lucky_ticket', name: 'Счастливый билет', description: 'Удваивает клики на 30 секунд', emoji: '🎫', quantity: 0, type: 'boost', effect: { type: 'doubleClick', value: 2, duration: 30 } },
  { id: 'golden_ticket', name: 'Золотой билет', description: 'Удваивает алмазы на 60 секунд', emoji: '🎟️', quantity: 0, type: 'goldenTicket', effect: { type: 'doubleGems', value: 2, duration: 60 } },
  { id: 'food_bag', name: 'Мешок еды', description: '+30 еды', emoji: '🍖', quantity: 0, type: 'food' },
  { id: 'costume', name: 'Костюм супергероя', description: 'Изменяет внешность питомца на 1 час', emoji: '🦸', quantity: 0, type: 'skin' },
];

// -------------------- Custom Hooks --------------------

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

function useDailyBonus() {
  const [daily, setDaily] = useState<DailyBonus>(() => {
    const saved = localStorage.getItem('dailyBonus');
    return saved ? JSON.parse(saved) : { lastClaimDate: '', streak: 0, claimedToday: false };
  });

  const claimDaily = useCallback((addGems: (amount: number) => void) => {
    if (daily.claimedToday) return false;
    const today = new Date().toISOString().split('T')[0];
    let newStreak = daily.streak + 1;
    if (daily.lastClaimDate) {
      const last = new Date(daily.lastClaimDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) newStreak = 1;
    }
    const reward = 50 + newStreak * 10;
    addGems(reward);
    setDaily({ lastClaimDate: today, streak: newStreak, claimedToday: true });
    localStorage.setItem('dailyBonus', JSON.stringify({ lastClaimDate: today, streak: newStreak, claimedToday: true }));
    return true;
  }, [daily]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (daily.lastClaimDate !== today && daily.claimedToday) {
      setDaily(prev => ({ ...prev, claimedToday: false }));
    }
  }, [daily]);

  return { daily, claimDaily };
}

function useQuests(initial: Quest[]) {
  const [quests, setQuests] = useState<Quest[]>(() => {
    const saved = localStorage.getItem('quests');
    return saved ? JSON.parse(saved) : initial;
  });

  const updateProgress = useCallback((type: Quest['type'], increment = 1) => {
    setQuests(prev => prev.map(q =>
      q.type === type && !q.completed
        ? { ...q, progress: Math.min(q.progress + increment, q.target) }
        : q
    ));
  }, []);

  const claimQuest = useCallback((questId: string, addGems: (amount: number) => void) => {
    setQuests(prev => {
      const quest = prev.find(q => q.id === questId);
      if (!quest || quest.completed || quest.progress < quest.target) return prev;
      addGems(quest.reward);
      return prev.map(q => q.id === questId ? { ...q, completed: true } : q);
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        setQuests(INITIAL_QUESTS.map(q => ({ ...q, progress: 0, completed: false })));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('quests', JSON.stringify(quests));
  }, [quests]);

  return { quests, updateProgress, claimQuest };
}

function useInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('inventory');
    return saved ? JSON.parse(saved) : SHOP_ITEMS.map(item => ({ ...item, quantity: 0 }));
  });

  const addItem = useCallback((itemId: string, quantity = 1) => {
    setInventory(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: item.quantity + quantity } : item
    ));
  }, []);

  const removeItem = useCallback((itemId: string, quantity = 1) => {
    setInventory(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity - quantity) } : item
    ));
  }, []);

  const useItem = useCallback((itemId: string, callback: (item: InventoryItem) => void) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item || item.quantity <= 0) return false;
    callback(item);
    removeItem(itemId, 1);
    return true;
  }, [inventory, removeItem]);

  useEffect(() => {
    localStorage.setItem('inventory', JSON.stringify(inventory));
  }, [inventory]);

  return { inventory, addItem, removeItem, useItem };
}

function usePets(selectedPetId: string, setSelectedPetId: (id: string) => void, level: number, friendsCount: number, eventActive: boolean) {
  const [petLevels, setPetLevels] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('petLevels');
    return saved ? JSON.parse(saved) : INITIAL_PET_LEVELS;
  });

  const isPetUnlocked = useCallback((pet: Pet) => {
    if (pet.unlock === 'start') return true;
    if (pet.unlock === 'level') return level >= (pet.level ?? 0);
    if (pet.unlock === 'invite') return friendsCount >= (pet.invites ?? 0);
    if (pet.unlock === 'event') return eventActive;
    return false;
  }, [level, friendsCount, eventActive]);

  const upgradePet = useCallback((petId: string, gems: number, setGems: (g: number) => void) => {
    const pet = PETS.find(p => p.id === petId);
    if (!pet) return false;
    const currentLevel = petLevels[petId] || 1;
    if (currentLevel >= (pet.maxLevel || 5)) return false;
    const cost = pet.upgradeCost ? pet.upgradeCost(currentLevel) : 30;
    if (gems < cost) return false;
    setGems(gems - cost);
    setPetLevels(prev => ({ ...prev, [petId]: currentLevel + 1 }));
    return true;
  }, [petLevels]);

  const getCurrentPetBonus = useCallback(() => {
    const pet = PETS.find(p => p.id === selectedPetId);
    if (!pet || !pet.bonus) return 0;
    const level = petLevels[pet.id] || 1;
    return pet.bonus.value * level;
  }, [selectedPetId, petLevels]);

  const getCurrentPetBonusType = useCallback(() => {
    const pet = PETS.find(p => p.id === selectedPetId);
    return pet?.bonus?.type;
  }, [selectedPetId]);

  useEffect(() => {
    localStorage.setItem('petLevels', JSON.stringify(petLevels));
  }, [petLevels]);

  return { petLevels, isPetUnlocked, upgradePet, getCurrentPetBonus, getCurrentPetBonusType };
}

function useSpecialEvent() {
  const [event, setEvent] = useState<SpecialEvent | null>(null);

  const generateEvent = useCallback(() => {
    if (event && event.expiresAt > Date.now()) return;
    if (Math.random() < 0.2) {
      const expiresAt = Date.now() + 60 * 60 * 1000;
      const type = ['rarePet', 'doubleRewards', 'boss'][Math.floor(Math.random() * 3)] as any;
      setEvent({ active: true, type, expiresAt, data: type === 'rarePet' ? { petId: 'unicorn' } : undefined });
    }
  }, [event]);

  useEffect(() => {
    const interval = setInterval(generateEvent, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [generateEvent]);

  return { specialEvent: event, setSpecialEvent: setEvent };
}

function useResources() {
  const [food, setFood] = useState<number | null>(null);
  const [gems, setGems] = useState<number | null>(null);
  const [totalClicks, setTotalClicks] = useState<number>(0);
  const [stamina, setStamina] = useState<number>(100);
  const [maxStamina, setMaxStamina] = useState<number>(100);
  const [staminaRegenRate, setStaminaRegenRate] = useState<number>(1);
  const [clickPower, setClickPower] = useState<number>(BASE_CLICK_POWER);
  const [clickUpgradeLevel, setClickUpgradeLevel] = useState<number>(0);
  const [regenUpgradeLevel, setRegenUpgradeLevel] = useState<number>(0);
  const [maxStaminaUpgradeLevel, setMaxStaminaUpgradeLevel] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem('resources');
    if (saved) {
      const data = JSON.parse(saved);
      setFood(data.food);
      setGems(data.gems);
      setTotalClicks(data.totalClicks);
      setStamina(data.stamina);
      setMaxStamina(data.maxStamina);
      setStaminaRegenRate(data.staminaRegenRate);
      setClickPower(data.clickPower);
      setClickUpgradeLevel(data.clickUpgradeLevel);
      setRegenUpgradeLevel(data.regenUpgradeLevel);
      setMaxStaminaUpgradeLevel(data.maxStaminaUpgradeLevel);
    } else {
      setFood(50);
      setGems(100);
    }
  }, []);

  useEffect(() => {
    if (food !== null && gems !== null) {
      localStorage.setItem('resources', JSON.stringify({
        food, gems, totalClicks, stamina, maxStamina, staminaRegenRate, clickPower,
        clickUpgradeLevel, regenUpgradeLevel, maxStaminaUpgradeLevel
      }));
    }
  }, [food, gems, totalClicks, stamina, maxStamina, staminaRegenRate, clickPower,
      clickUpgradeLevel, regenUpgradeLevel, maxStaminaUpgradeLevel]);

  return {
    food, setFood,
    gems, setGems,
    totalClicks, setTotalClicks,
    stamina, setStamina,
    maxStamina, setMaxStamina,
    staminaRegenRate, setStaminaRegenRate,
    clickPower, setClickPower,
    clickUpgradeLevel, setClickUpgradeLevel,
    regenUpgradeLevel, setRegenUpgradeLevel,
    maxStaminaUpgradeLevel, setMaxStaminaUpgradeLevel,
  };
}

function useAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    const saved = localStorage.getItem('achievements');
    return saved ? JSON.parse(saved) : [
      { id: 'ach1', title: 'Новичок', description: 'Сделайте 100 кликов', condition: (s: any) => s.totalClicks >= 100, reward: 50, icon: '🎯', completed: false },
      { id: 'ach2', title: 'Заводчик', description: 'Разблокируйте 3 питомцев', condition: (s: any) => Object.keys(s.petLevels).filter(id => id !== 'dog' && id !== 'cat' && id !== 'rabbit').length >= 3, reward: 100, icon: '🐕', completed: false },
      { id: 'ach3', title: 'Энерджайзер', description: 'Восстановите 1000 энергии', condition: (s: any) => s.totalStaminaRestored >= 1000, reward: 80, icon: '⚡', completed: false },
      { id: 'ach4', title: 'Миллионер', description: 'Накопите 1000 алмазов', condition: (s: any) => s.gems >= 1000, reward: 200, icon: '💎', completed: false },
      { id: 'ach5', title: 'Друг человека', description: 'Пригласите 5 друзей', condition: (s: any) => s.friendsCount >= 5, reward: 150, icon: '👥', completed: false },
      { id: 'ach6', title: 'Любитель бустеров', description: 'Используйте 10 бустеров', condition: (s: any) => s.boostersUsed >= 10, reward: 120, icon: '🚀', completed: false },
      { id: 'ach7', title: 'Гурман', description: 'Съешьте 50 еды', condition: (s: any) => s.foodEaten >= 50, reward: 70, icon: '🍖', completed: false },
      { id: 'ach8', title: 'Исследователь', description: 'Откройте все виды питомцев', condition: (s: any) => PETS.every(pet => s.isPetUnlocked(pet)), reward: 300, icon: '🔓', completed: false },
      { id: 'ach9', title: 'Комбобой', description: 'Сделайте 50 кликов подряд', condition: (s: any) => s.maxCombo >= 50, reward: 100, icon: '🔥', completed: false },
      { id: 'ach10', title: 'Ветеран', description: 'Играйте 30 дней', condition: (s: any) => s.daysInGame >= 30, reward: 500, icon: '🏆', completed: false },
    ];
  });

  const checkAchievements = useCallback((state: any, addGems: (amt: number) => void) => {
    let updated = false;
    setAchievements(prev => {
      const newAch = prev.map(ach => {
        if (!ach.completed && ach.condition(state)) {
          addGems(ach.reward);
          updated = true;
          return { ...ach, completed: true };
        }
        return ach;
      });
      if (updated) {
        localStorage.setItem('achievements', JSON.stringify(newAch));
      }
      return newAch;
    });
  }, []);

  return { achievements, checkAchievements };
}

// -------------------- Main App --------------------
function App() {
  const {
    food, setFood,
    gems, setGems,
    totalClicks, setTotalClicks,
    stamina, setStamina,
    maxStamina, setMaxStamina,
    staminaRegenRate, setStaminaRegenRate,
    clickPower, setClickPower,
    clickUpgradeLevel, setClickUpgradeLevel,
    regenUpgradeLevel, setRegenUpgradeLevel,
    maxStaminaUpgradeLevel, setMaxStaminaUpgradeLevel,
  } = useResources();

  const { level, expInCurrent, expNeeded, percent: expPercent } = useLevel(totalClicks);
  const { daily, claimDaily } = useDailyBonus();
  const { quests, updateProgress, claimQuest } = useQuests(INITIAL_QUESTS);
  const { inventory, addItem, useItem } = useInventory();
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [eventActive, setEventActive] = useState(false);
  const [eventTimeLeft, setEventTimeLeft] = useState('');
  const { specialEvent, setSpecialEvent } = useSpecialEvent();
  const { achievements, checkAchievements } = useAchievements();

  // Дополнительные счетчики для достижений
  const [totalStaminaRestored, setTotalStaminaRestored] = useState<number>(0);
  const [boostersUsed, setBoostersUsed] = useState<number>(0);
  const [foodEaten, setFoodEaten] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Лимит покупок еды
  const [foodPurchasesToday, setFoodPurchasesToday] = useState<number>(() => {
    const saved = localStorage.getItem('foodPurchasesToday');
    return saved ? parseInt(saved) : 0;
  });
  const [lastFoodPurchaseReset, setLastFoodPurchaseReset] = useState<string>(() => {
    const saved = localStorage.getItem('lastFoodPurchaseReset');
    return saved || new Date().toISOString().split('T')[0];
  });

  // Бустеры
  const [boostActive, setBoostActive] = useState(false);
  const [boostTimeLeft, setBoostTimeLeft] = useState(0);
  const originalClickPowerRef = useRef(clickPower);

  const [gemBoostActive, setGemBoostActive] = useState(false);
  const [gemBoostTimeLeft, setGemBoostTimeLeft] = useState(0);

  // Костюм
  const [costumeActive, setCostumeActive] = useState(false);
  const [costumeTimeLeft, setCostumeTimeLeft] = useState(0);
  const [costumeEmoji, setCostumeEmoji] = useState<string>(''); // запасной вариант

  // Дата первого входа
  const [firstLoginDate, setFirstLoginDate] = useState<string>(() => {
    const saved = localStorage.getItem('firstLoginDate');
    if (saved) return saved;
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('firstLoginDate', today);
    return today;
  });

  const daysInGame = useMemo(() => {
    const first = new Date(firstLoginDate);
    const now = new Date();
    const diffTime = now.getTime() - first.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }, [firstLoginDate]);

  const [userAvatar, setUserAvatar] = useState('');
  const userId = tg?.initDataUnsafe?.user?.id || 'guest123';
  const inviteLink = `https://t.me/yourpetaibot?start=ref_${userId}`;

  const [selectedPetId, setSelectedPetId] = useState<string>(() => localStorage.getItem('selectedPet') || 'dog');
  const { petLevels, isPetUnlocked, upgradePet, getCurrentPetBonus, getCurrentPetBonusType } = usePets(selectedPetId, setSelectedPetId, level, friendsCount, eventActive);
  const currentPet = PETS.find(p => p.id === selectedPetId) || PETS[0];

  const totalClickPower = useMemo(() => {
    const base = clickPower;
    const bonus = getCurrentPetBonus();
    if (currentPet.bonus?.type === 'clickPower') return base + bonus;
    return base;
  }, [clickPower, currentPet, getCurrentPetBonus]);

  // Применение бонусов питомца
  useEffect(() => {
    if (currentPet.bonus?.type === 'regen') {
      const bonus = getCurrentPetBonus();
      setStaminaRegenRate(prev => prev + bonus);
      return () => setStaminaRegenRate(prev => prev - bonus);
    }
  }, [currentPet, getCurrentPetBonus, setStaminaRegenRate]);

  useEffect(() => {
    if (currentPet.bonus?.type === 'maxStamina') {
      const bonus = getCurrentPetBonus();
      setMaxStamina(prev => prev + bonus);
      setStamina(prev => prev + bonus);
      return () => {
        setMaxStamina(prev => prev - bonus);
        setStamina(prev => Math.max(prev - bonus, 0));
      };
    }
  }, [currentPet, getCurrentPetBonus, setMaxStamina, setStamina]);

  // UI states
  const [loading, setLoading] = useState(true);
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

  // Toast
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Вибрация
  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }, []);

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

  // Сброс лимита покупок еды при смене дня
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (lastFoodPurchaseReset !== today) {
      setFoodPurchasesToday(0);
      setLastFoodPurchaseReset(today);
      localStorage.setItem('foodPurchasesToday', '0');
      localStorage.setItem('lastFoodPurchaseReset', today);
    }
  }, [lastFoodPurchaseReset]);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) setUserAvatar(user.first_name?.charAt(0).toUpperCase() || '?');
    }
    setTimeout(() => setLoading(false), 500);
    if (!localStorage.getItem('tutorialCompleted')) {
      setShowTutorial(true);
    }
  }, []);

  useEffect(() => {
    const day = new Date().getDay();
    const active = day === 0 || day === 6;
    setEventActive(active);
    if (active) {
      const end = new Date();
      end.setDate(end.getDate() + (7 - end.getDay()));
      end.setHours(23, 59, 59, 999);
      const diff = end.getTime() - Date.now();
      setEventTimeLeft(`${Math.floor(diff / (1000 * 60 * 60))}ч ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}м`);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFood(prev => Math.max((prev ?? 0) - 15, 0));
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [setFood]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStamina(prev => Math.min(prev + staminaRegenRate, maxStamina));
    }, 2000);
    return () => clearInterval(interval);
  }, [staminaRegenRate, maxStamina, setStamina]);

  useEffect(() => {
    if (floaters.length === 0) return;
    const timer = setTimeout(() => setFloaters([]), 1000);
    return () => clearTimeout(timer);
  }, [floaters]);

  // Combo
  const resetCombo = useCallback(() => {
    setCombo(0);
    if (comboTimeoutRef.current) {
      clearTimeout(comboTimeoutRef.current);
      comboTimeoutRef.current = null;
    }
  }, []);

  const incrementCombo = useCallback(() => {
    setCombo(prev => {
      const newCombo = prev + 1;
      if (newCombo > maxCombo) setMaxCombo(newCombo);
      return newCombo;
    });
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    comboTimeoutRef.current = setTimeout(resetCombo, 2000);
  }, [maxCombo, resetCombo]);

  const sendAction = (action: string, payload: any = {}) => {
    if (tg) tg.sendData(JSON.stringify({ action, ...payload }));
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastClickTime.current < 100) return;
    lastClickTime.current = now;

    if (gems === null) return;
    if (stamina < 1) {
      showToast('Нет сил! Подожди, энергия восстановится.', 'error');
      vibrate([50, 100, 50]);
      return;
    }

    incrementCombo();
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 300);

    let gain = totalClickPower;
    if (specialEvent?.active && specialEvent.type === 'doubleRewards') gain *= 2;
    if (gemBoostActive) gain *= 2; // золотой билет

    setGems(g => g! + gain);
    setGemsFlash(true);
    setTimeout(() => setGemsFlash(false), 300);
    setStamina(prev => Math.max(prev - 1, 0));
    setTotalClicks(prev => prev + 1);
    updateProgress('click', 1);

    for (let i = 0; i < 3; i++) {
      const x = Math.random() * 200 + 25;
      const y = Math.random() * 150 + 15;
      const emoji = Math.random() > 0.5 ? '✨' : '💎';
      setFloaters(prev => [...prev, { id: Date.now() + Math.random(), value: gain, x, y, emoji }]);
    }

    vibrate(30);
    sendAction('click', { power: gain });

    const state = { totalClicks: totalClicks + 1, petLevels, friendsCount, gems: gems! + gain, totalStaminaRestored, boostersUsed, foodEaten, maxCombo: maxCombo > combo ? maxCombo : combo, daysInGame, isPetUnlocked };
    checkAchievements(state, (amt) => setGems(prev => prev! + amt));
  };

  const handleFeed = () => {
    if (food === null) return showToast('Данные о еде загружаются', 'error');
    if (food <= 0) return showToast('Нет еды! Купи в магазине.', 'error');
    setFood(prev => Math.max((prev ?? 0) - 1, 0));
    const restore = Math.min(10, maxStamina - stamina);
    setStamina(prev => Math.min(prev + 10, maxStamina));
    setTotalStaminaRestored(prev => prev + restore);
    setFoodEaten(prev => prev + 1);
    updateProgress('feed', 1);
    showToast('Питомец накормлен! +10 энергии', 'success');
    vibrate(30);
    sendAction('feed');
    const state = { totalClicks, petLevels, friendsCount, gems: gems!, totalStaminaRestored: totalStaminaRestored + restore, boostersUsed, foodEaten: foodEaten + 1, maxCombo, daysInGame, isPetUnlocked };
    checkAchievements(state, (amt) => setGems(prev => prev! + amt));
  };

  const handlePlay = () => {
    if (stamina < 20) return showToast('Недостаточно энергии для игры!', 'error');
    setStamina(prev => prev - 20);
    let reward = 30;
    if (specialEvent?.active && specialEvent.type === 'doubleRewards') reward *= 2;
    if (gemBoostActive) reward *= 2; // золотой билет тоже влияет на награду за игру
    setGems(prev => (prev ?? 0) + reward);
    setGemsFlash(true);
    setTimeout(() => setGemsFlash(false), 300);
    updateProgress('play', 1);
    showToast(`Поиграли! +${reward} алмазов`, 'success');
    vibrate(50);
    sendAction('play');
    const state = { totalClicks, petLevels, friendsCount, gems: gems! + reward, totalStaminaRestored, boostersUsed, foodEaten, maxCombo, daysInGame, isPetUnlocked };
    checkAchievements(state, (amt) => setGems(prev => prev! + amt));
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    showToast('✅ Ссылка скопирована!', 'success');
    setFriendsCount(prev => prev + 1);
    updateProgress('invite', 1);
    setGems(prev => (prev ?? 0) + 1000); // 1000 вместо 50
    setGemsFlash(true);
    setTimeout(() => setGemsFlash(false), 300);
    vibrate(100);
    const state = { totalClicks, petLevels, friendsCount: friendsCount + 1, gems: gems! + 1000, totalStaminaRestored, boostersUsed, foodEaten, maxCombo, daysInGame, isPetUnlocked };
    checkAchievements(state, (amt) => setGems(prev => prev! + amt));
  };

  const buyItem = (item: InventoryItem, price: number) => {
    if (gems === null) return;
    if (gems < price) return showToast('Не хватает алмазов!', 'error');

    // Лимит на покупку еды
    if (item.id === 'food_bag') {
      if (foodPurchasesToday >= MAX_FOOD_PURCHASES_PER_DAY) {
        showToast('Лимит покупок еды на сегодня исчерпан!', 'error');
        return;
      }
      setFoodPurchasesToday(prev => prev + 1);
      localStorage.setItem('foodPurchasesToday', (foodPurchasesToday + 1).toString());
    }

    setGems(prev => prev! - price);
    addItem(item.id, 1);
    updateProgress('upgrade', 1);
    showToast(`Куплено: ${item.name}`, 'success');
    vibrate(30);
    sendAction('buyItem', { itemId: item.id, price });
    const state = { totalClicks, petLevels, friendsCount, gems: gems! - price, totalStaminaRestored, boostersUsed, foodEaten, maxCombo, daysInGame, isPetUnlocked };
    checkAchievements(state, (amt) => setGems(prev => prev! + amt));
  };

  const handleUseItem = (item: InventoryItem) => {
    useItem(item.id, (usedItem) => {
      if (usedItem.type === 'boost' && usedItem.effect?.type === 'doubleClick') {
        if (boostActive) {
          showToast('Бустер уже активен!', 'error');
          return;
        }
        setBoostActive(true);
        setBoostTimeLeft(usedItem.effect.duration);
        originalClickPowerRef.current = clickPower;
        setClickPower(prev => prev * 2);
        const interval = setInterval(() => {
          setBoostTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              setBoostActive(false);
              setClickPower(originalClickPowerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        setBoostersUsed(prev => prev + 1);
        showToast(`Бустер кликов активирован на ${usedItem.effect.duration} сек!`, 'success');
        vibrate(100);
      } else if (usedItem.type === 'goldenTicket' && usedItem.effect?.type === 'doubleGems') {
        if (gemBoostActive) {
          showToast('Бустер алмазов уже активен!', 'error');
          return;
        }
        setGemBoostActive(true);
        setGemBoostTimeLeft(usedItem.effect.duration);
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
        setBoostersUsed(prev => prev + 1);
        showToast(`Бустер алмазов активирован на ${usedItem.effect.duration} сек!`, 'success');
        vibrate(100);
      } else if (usedItem.type === 'food') {
        setFood(prev => Math.min((prev ?? 0) + 30, MAX_FOOD));
        setFoodEaten(prev => prev + 1);
        showToast('+30 еды!', 'success');
        vibrate(30);
      } else if (usedItem.type === 'skin') {
        if (costumeActive) {
          showToast('Костюм уже надет!', 'error');
          return;
        }
        setCostumeActive(true);
        setCostumeTimeLeft(3600); // 1 час = 3600 секунд
        // Запоминаем оригинальную эмодзи? Нет, просто показываем отдельный индикатор
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
        showToast('Костюм супергероя надет!', 'success');
        vibrate(100);
      }
    });
  };

  const bonusDisplay = useMemo(() => {
    const bonus = getCurrentPetBonus();
    const type = getCurrentPetBonusType();
    if (!bonus) return null;
    switch (type) {
      case 'clickPower': return `+${bonus.toFixed(1)} к силе клика`;
      case 'regen': return `+${bonus.toFixed(1)} к регенерации`;
      case 'maxStamina': return `+${bonus} к макс. энергии`;
      default: return null;
    }
  }, [getCurrentPetBonus, getCurrentPetBonusType]);

  if (loading) {
    return <div style={styles.loadingContainer}>Загружаем питомца...</div>;
  }

  return (
    <div style={styles.container}>
      {specialEvent?.active && (
        <div style={styles.eventBanner}>
          {specialEvent.type === 'rarePet' && '✨ Редкий питомец временно доступен! ✨'}
          {specialEvent.type === 'doubleRewards' && '✨ Удвоенные награды! ✨'}
          {specialEvent.type === 'boss' && '✨ Босс! Атакуй! ✨'}
          <span> До окончания: {Math.ceil((specialEvent.expiresAt - Date.now()) / 60000)} мин</span>
        </div>
      )}

      <Header
        userAvatar={userAvatar}
        friendsCount={friendsCount}
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
          food={food ?? 0}
          maxFood={MAX_FOOD}
          level={level}
          expInCurrent={expInCurrent}
          expNeeded={expNeeded}
          expPercent={expPercent}
          gems={gems ?? 0}
          clickPower={totalClickPower}
          gemsFlash={gemsFlash}
        />

        <Pet
          ref={petRef}
          emoji={costumeActive ? '🦸' : currentPet.emoji} // смена эмодзи при костюме
          isClicking={isClicking}
          onClick={handleClick}
          floaters={floaters}
        />

        <div style={styles.energyWrapper}>
          <div style={styles.barLabel}>⚡ Энергия (+{staminaRegenRate.toFixed(1)}/сек)</div>
          <div style={styles.barBg}>
            <div style={{ ...styles.barFill, width: `${(stamina / maxStamina) * 100}%`, background: '#ffcc00' }} />
            <span style={styles.barText}>{stamina}/{maxStamina}</span>
          </div>
          {bonusDisplay && (
            <div style={styles.bonusIndicator}>
              🐾 Бонус: {bonusDisplay}
            </div>
          )}
          {boostActive && (
            <div style={styles.boostIndicator}>
              🚀 Бустер кликов: {boostTimeLeft}с
            </div>
          )}
          {gemBoostActive && (
            <div style={styles.boostIndicator}>
              💎 Бустер алмазов: {gemBoostTimeLeft}с
            </div>
          )}
          {costumeActive && (
            <div style={styles.boostIndicator}>
              🦸 Костюм: {Math.floor(costumeTimeLeft / 60)}м {costumeTimeLeft % 60}с
            </div>
          )}
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

      {/* Модальные окна */}
      {showDailyBonus && (
        <DailyBonusModal
          daily={daily}
          onClaim={() => claimDaily((amt) => {
            setGems(g => (g ?? 0) + amt);
            setGemsFlash(true);
            setTimeout(() => setGemsFlash(false), 300);
            showToast(`Получено ${amt} алмазов!`, 'success');
            vibrate(100);
          })}
          onClose={() => setShowDailyBonus(false)}
        />
      )}

      {showQuests && (
        <QuestsModal
          quests={quests}
          onClaim={(id) => claimQuest(id, (amt) => {
            setGems(g => (g ?? 0) + amt);
            setGemsFlash(true);
            setTimeout(() => setGemsFlash(false), 300);
            showToast(`Награда ${amt} алмазов!`, 'success');
            vibrate(100);
          })}
          onClose={() => setShowQuests(false)}
        />
      )}

      {showInventory && (
        <InventoryModal
          inventory={inventory}
          onUse={handleUseItem}
          onClose={() => setShowInventory(false)}
        />
      )}

      {showShop && (
        <ShopModal
          gems={gems ?? 0}
          clickUpgradeLevel={clickUpgradeLevel}
          regenUpgradeLevel={regenUpgradeLevel}
          maxStaminaUpgradeLevel={maxStaminaUpgradeLevel}
          clickPower={totalClickPower}
          staminaRegenRate={staminaRegenRate}
          maxStamina={maxStamina}
          foodPurchasesToday={foodPurchasesToday}
          maxFoodPurchases={MAX_FOOD_PURCHASES_PER_DAY}
          onBuyClickUpgrade={() => {
            const cost = 10 + clickUpgradeLevel * 5;
            if (gems! < cost) return showToast('Не хватает алмазов', 'error');
            setGems(g => g! - cost);
            setClickUpgradeLevel(l => l + 1);
            setClickPower(p => p + 0.2);
            updateProgress('upgrade', 1);
            showToast('Улучшение куплено!', 'success');
            vibrate(50);
          }}
          onBuyRegenUpgrade={() => {
            const cost = 15 + regenUpgradeLevel * 8;
            if (gems! < cost) return showToast('Не хватает алмазов', 'error');
            setGems(g => g! - cost);
            setRegenUpgradeLevel(l => l + 1);
            setStaminaRegenRate(r => r + 0.5);
            updateProgress('upgrade', 1);
            showToast('Улучшение куплено!', 'success');
            vibrate(50);
          }}
          onBuyMaxStaminaUpgrade={() => {
            const cost = 30 + maxStaminaUpgradeLevel * 10;
            if (gems! < cost) return showToast('Не хватает алмазов', 'error');
            setGems(g => g! - cost);
            setMaxStaminaUpgradeLevel(l => l + 1);
            setMaxStamina(prev => prev + 20);
            setStamina(prev => prev + 20);
            updateProgress('upgrade', 1);
            showToast('Улучшение куплено!', 'success');
            vibrate(50);
          }}
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
          friendsCount={friendsCount}
          totalClicks={totalClicks}
          level={level}
          gems={gems ?? 0}
          daysInGame={daysInGame}
          onInvite={handleOpenInvite}
          onAchievements={handleOpenAchievements}
          leaders={[]}
          pets={PETS}
          isPetUnlocked={isPetUnlocked}
          selectedPetId={selectedPetId}
          onSelectPet={(id) => { setSelectedPetId(id); localStorage.setItem('selectedPet', id); }}
          petLevels={petLevels}
          onUpgradePet={(petId) => upgradePet(petId, gems!, (newGems) => {
            setGems(newGems);
            showToast('Питомец улучшен!', 'success');
            vibrate(100);
          })}
          onClose={() => setShowProfileMenu(false)}
        />
      )}

      {showAchievements && (
        <AchievementsModal
          achievements={achievements}
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

      {/* Toast уведомления */}
      <div style={styles.toastContainer}>
        {toasts.map(toast => (
          <div key={toast.id} style={{...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastInfo)}}>
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
  daily: DailyBonus;
  onClaim: () => void;
  onClose: () => void;
}

const DailyBonusModal: React.FC<DailyBonusModalProps> = ({ daily, onClaim, onClose }) => (
  <div style={styles.modalOverlay} onClick={onClose}>
    <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><h3>🎁 Ежедневный бонус</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
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
      <div style={styles.modalHeader}><h3>📋 Задания</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
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
      <div style={styles.modalHeader}><h3>🎒 Инвентарь</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
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
  clickPower, staminaRegenRate, maxStamina,
  foodPurchasesToday, maxFoodPurchases,
  onBuyClickUpgrade, onBuyRegenUpgrade, onBuyMaxStaminaUpgrade,
  onBuyItem, shopItems, onClose
}) => (
  <div style={styles.modalOverlay} onClick={onClose}>
    <div style={{...styles.modalContent, animation: 'slideIn 0.3s ease'}} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><h3>🛒 Магазин</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
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
      <div style={styles.modalHeader}><h3>👥 Пригласить друга</h3><button style={styles.closeButton} onClick={onClose}>✕</button></div>
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
  daysInGame, onInvite, onAchievements, leaders, pets, isPetUnlocked, selectedPetId, onSelectPet, petLevels, onUpgradePet, onClose
}) => (
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
        <div style={styles.leadersPlaceholder}>Таблица лидеров (скоро)</div>
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

interface AchievementsModalProps {
  achievements: Achievement[];
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
  bonusIndicator: {
    marginTop: '6px',
    fontSize: '11px',
    color: '#ffaa00',
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
  leadersPlaceholder: { textAlign: 'center' as const, color: '#aaa', padding: '14px' },
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
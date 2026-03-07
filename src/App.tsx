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
  type: 'food' | 'boost' | 'skin';
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

// -------------------- Constants --------------------
const MAX_FOOD = 100;
const BASE_CLICK_POWER = 1;

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
  { id: 'food_bag', name: 'Мешок еды', description: '+30 еды', emoji: '🍖', quantity: 0, type: 'food' },
  { id: 'costume', name: 'Костюм супергероя', description: 'Изменяет внешность питомца на 1 час', emoji: '🦸', quantity: 0, type: 'skin' },
];

// -------------------- Custom Hooks --------------------
// (все хуки useLevel, useDailyBonus, useQuests, useInventory, usePets, useSpecialEvent, useResources)
// они у тебя уже есть в последнем коде – я их не менял, поэтому не копирую сюда, чтобы не раздувать ответ.
// Они должны быть точно такими же, как в твоём файле.

// ========== ВСТАВЬ СЮДА ВСЕ ХУКИ ИЗ ТВОЕГО ТЕКУЩЕГО ФАЙЛА ==========
// Они идут от строки function useLevel... до function useResources...
// ===================================================================

// -------------------- Main App --------------------
function App() {
  // ... (вся логика App остаётся без изменений)
  // Я не копирую её сюда, чтобы не дублировать, но она точно такая же, как в последнем коде,
  // только в return обёртка scrollableContent и кнопки снизу.
  // ВАЖНО: в StatsBars больше не передаются stamina и staminaRegenRate, только food, maxFood, level,
  // expInCurrent, expNeeded, expPercent, gems, clickPower. Убедись, что интерфейс StatsBars соответствует.
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
}

const StatsBars: React.FC<StatsBarsProps> = ({
  food, maxFood, level, expInCurrent, expNeeded, expPercent, gems, clickPower
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
      <div style={styles.statCard}>
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
  floaters: Array<{ id: number; value: number; x: number; y: number }>;
}

const Pet = React.forwardRef<HTMLDivElement, PetProps>(({ emoji, isClicking, onClick, floaters }, ref) => (
  <div style={styles.petContainer}>
    <div
      ref={ref}
      style={{
        ...styles.petCircle,
        animation: isClicking ? 'pulse 0.3s ease-out' : 'none',
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
          +{f.value.toFixed(1)}
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
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onFeed, onPlay, onShop, onDaily, onQuests, onInventory }) => (
  <div style={styles.buttonsContainer}>
    <div style={styles.actionsRow}>
      <button style={{ ...styles.button, ...styles.feedButton }} onClick={onFeed}>🍖 Покормить</button>
      <button style={{ ...styles.button, ...styles.playButton }} onClick={onPlay}>🎾 Поиграть</button>
      <button style={{ ...styles.button, ...styles.shopButton }} onClick={onDaily}>🎁 Бонус</button>
    </div>
    <div style={styles.actionsRow}>
      <button style={{ ...styles.button, ...styles.shopButton }} onClick={onQuests}>📋 Задания</button>
      <button style={{ ...styles.button, ...styles.shopButton }} onClick={onInventory}>🎒 Инвентарь</button>
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
          if (item.id === 'costume') price = 100;
          return (
            <div key={item.id} style={styles.shopItem} onClick={() => onBuyItem(item, price)}>
              <span>{item.emoji} {item.name} - {item.description}</span>
              <span>{price} 💎</span>
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
      <p>За каждого друга ты получишь 50 💎 после его первого клика.</p>
      <div style={styles.inviteLinkContainer}>
        <input type="text" value={inviteLink} readOnly style={styles.inviteLinkInput} />
        <button onClick={onCopy} style={styles.copyButton}>📋</button>
      </div>
    </div>
  </div>
);

interface ProfileModalProps {
  activeTab: 'profile' | 'leaders' | 'pets';
  setActiveTab: (tab: 'profile' | 'leaders' | 'pets') => void;
  userAvatar: string;
  user?: any;
  friendsCount: number;
  totalClicks: number;
  level: number;
  gems: number;
  daysInGame: number;
  onInvite: () => void;
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
  daysInGame, onInvite, leaders, pets, isPetUnlocked, selectedPetId, onSelectPet, petLevels, onUpgradePet, onClose
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
              <span style={styles.statBoxValue}>{gems}</span>
              <span style={styles.statBoxLabel}>Алмазы</span>
            </div>
          </div>

          <button onClick={onInvite} style={styles.inviteButton}>
            👥 Пригласить друга
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
const styles = {
  container: { 
    height: '100vh',
    background: '#000', 
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
  avatar: { width: '36px', height: '36px', borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', border: '2px solid #666', cursor: 'pointer' },
  friendsBadge: { background: '#222', borderRadius: '20px', padding: '4px 8px', fontSize: '13px', cursor: 'pointer', border: '1px solid #444', display: 'flex', alignItems: 'center', gap: '4px' },
  nameDisplay: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
  petName: { fontSize: '18px', fontWeight: 'bold', color: '#fff' },
  editIcon: { fontSize: '14px', opacity: 0.7 },
  nameEditor: { display: 'flex', alignItems: 'center', gap: '4px' },
  nameInput: { background: '#222', border: '1px solid #444', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '14px', outline: 'none' },
  nameSaveBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' },
  nameCancelBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' },
  scrollableContent: {
    flex: 1,
    overflowY: 'auto' as const,
    marginBottom: '8px',
    paddingRight: '2px',
  },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px', marginBottom: '8px' },
  statCard: {
    background: '#222',
    borderRadius: '8px',
    padding: '6px 2px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    border: '1px solid #444',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  statValue: { fontSize: '15px', fontWeight: 'bold', color: '#ffcc00' },
  statLabel: { fontSize: '9px', color: '#aaa', marginTop: '2px' },
  barWrapper: { marginBottom: '2px' },
  barLabel: { fontSize: '12px', fontWeight: 'bold', color: '#fff', marginBottom: '2px' },
  barBg: { background: '#222', height: '16px', borderRadius: '6px', position: 'relative' as const, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '6px', transition: 'width 0.3s ease' },
  barText: { position: 'absolute' as const, top: 0, left: 0, width: '100%', textAlign: 'center' as const, lineHeight: '16px', fontSize: '10px', color: '#000', fontWeight: 'bold' },
  petContainer: { position: 'relative' as const, margin: '5px auto 8px', width: 'fit-content' },
  petCircle: {
    position: 'relative' as const,
    width: '200px',
    height: '180px',
    background: '#222',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '3px solid #444',
    overflow: 'hidden',
    transition: 'box-shadow 0.3s',
  },
  clickFlash: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,204,0,0.6) 0%, rgba(255,204,0,0) 70%)',
    animation: 'fadeOut 0.3s ease-out forwards',
    pointerEvents: 'none' as const,
  },
  energyWrapper: { marginTop: '5px', marginBottom: '8px' },
  buttonsContainer: { marginTop: '0px' },
  actionsRow: { display: 'flex', gap: '6px', marginBottom: '6px' },
  button: { flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s, transform 0.1s', touchAction: 'manipulation' },
  feedButton: { background: '#666', color: '#fff' },
  playButton: { background: '#666', color: '#fff' },
  shopButton: { background: '#666', color: '#fff' },
  modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#111', borderRadius: '20px', width: '90%', maxWidth: '350px', padding: '14px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transformOrigin: 'top', animation: 'slideIn 0.3s ease' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  modalTitle: { fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 },
  closeButton: { background: 'none', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer' },
  tabs: { display: 'flex', marginBottom: '10px', borderBottom: '1px solid #444' },
  tabButton: { flex: 1, background: 'none', border: 'none', color: '#fff', padding: '6px', cursor: 'pointer', fontSize: '13px', borderBottom: '2px solid transparent' },
  activeTab: { borderBottom: '2px solid #ffcc00', color: '#ffcc00' },

  // Profile tab styles
  profileContent: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  profileHeader: { display: 'flex', gap: '10px', alignItems: 'center' },
  profileAvatarLarge: { width: '50px', height: '50px', borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', border: '2px solid #ffcc00' },
  profileNames: { display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  profileName: { fontSize: '16px', fontWeight: 'bold', color: '#ffcc00' },
  profileUsername: { fontSize: '11px', color: '#aaa' },
  profileDays: { fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '6px' },
  statBox: { background: '#222', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', border: '1px solid #444' },
  statBoxValue: { fontSize: '18px', fontWeight: 'bold', color: '#ffcc00' },
  statBoxLabel: { fontSize: '10px', color: '#aaa', marginTop: '2px' },

  inviteButton: { background: '#ffcc00', color: '#000', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', width: '100%', marginTop: '6px' },

  leadersPlaceholder: { textAlign: 'center' as const, color: '#aaa', padding: '14px' },

  // Pets list styles
  petsList: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  petItem: { display: 'flex', alignItems: 'center', background: '#222', borderRadius: '6px', padding: '6px', border: '1px solid #444', cursor: 'pointer' },
  petItemSelected: { border: '2px solid #ffcc00' },
  petItemLocked: { opacity: 0.5, cursor: 'not-allowed' },
  petItemEmoji: { fontSize: '24px', marginRight: '8px' },
  petItemInfo: { flex: 1 },
  petItemName: { fontSize: '12px', fontWeight: 'bold' },
  petItemCondition: { fontSize: '9px', color: '#aaa' },
  petItemSelectedMark: { color: '#ffcc00', fontWeight: 'bold', fontSize: '14px', marginLeft: '4px' },
  upgradeButton: { marginLeft: '4px', background: '#ffcc00', border: 'none', borderRadius: '4px', padding: '3px 5px', cursor: 'pointer', fontSize: '10px' },

  referralButton: { background: '#666', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px', fontSize: '11px', cursor: 'pointer', width: '100%', marginTop: '6px' },
  eventBanner: { background: '#ffcc00', color: '#000', padding: '6px', textAlign: 'center' as const, borderRadius: '6px', marginBottom: '6px', fontWeight: 'bold', fontSize: '11px' },
  inviteLinkContainer: { display: 'flex', gap: '4px', marginBottom: '6px' },
  inviteLinkInput: { flex: 1, background: '#222', border: '1px solid #444', borderRadius: '4px', padding: '5px', color: '#fff', fontSize: '10px', outline: 'none' },
  copyButton: { background: '#444', border: 'none', borderRadius: '4px', padding: '5px 8px', color: '#fff', cursor: 'pointer', fontSize: '12px' },
  shopSection: { marginBottom: '12px' },
  shopItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', padding: '8px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', border: '1px solid #444', fontSize: '11px' },
  questItem: { background: '#222', padding: '6px', borderRadius: '6px', marginBottom: '4px', fontSize: '11px' },
  tutorialBox: { background: '#111', padding: '20px', borderRadius: '16px', textAlign: 'center' as const, maxWidth: '250px' },
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
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255,204,0,0.7); }
  70% { box-shadow: 0 0 0 20px rgba(255,204,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,204,0,0); }
}
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}`;
document.head.appendChild(styleSheet);

export default App;
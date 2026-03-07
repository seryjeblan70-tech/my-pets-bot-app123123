const API_BASE_URL = 'https://mmymunuappstg.bothost.ru'; // твой домен без слеша

function getInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

async function request(endpoint: string, method: string = 'POST', body?: any) {
  const initData = getInitData();
  const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
}

export const api = {
    init: () => request('/init', 'POST'),
  click: () => request('/click'),
  feed: () => request('/feed'),
  play: () => request('/play'),
  buyClickUpgrade: () => request('/buy_click_upgrade'),
  buyRegenUpgrade: () => request('/buy_regen_upgrade'),
  buyMaxStaminaUpgrade: () => request('/buy_max_stamina_upgrade'),
  buyItem: (itemId: string, price: number) => request('/buy_item', 'POST', { itemId, price }),
  useItem: (itemId: string) => request('/use_item', 'POST', { itemId }),
  claimDaily: () => request('/claim_daily'),
  claimQuest: (id: string) => request('/claim_quest', 'POST', { id }),
  upgradePet: (petId: string) => request('/upgrade_pet', 'POST', { petId }),
  selectPet: (petId: string) => request('/select_pet', 'POST', { petId }),
  getLeaders: () => request('/leaders', 'GET'),
};
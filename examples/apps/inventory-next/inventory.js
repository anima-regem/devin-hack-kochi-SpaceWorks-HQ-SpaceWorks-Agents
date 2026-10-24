// Synthetic source fixture; no external database or live stock connection.
const inventory = [{ itemId: 'demo-filament', onHand: 4, kind: 'consumable' }];
export function listItems() { return inventory.map(item => ({ ...item })); }
export function receiveStock(itemId, quantity) {
  const item = inventory.find(candidate => candidate.itemId === itemId);
  if (!item || !Number.isInteger(quantity) || quantity < 1) throw new Error('Invalid stock receipt');
  item.onHand += quantity;
  return { ...item };
}

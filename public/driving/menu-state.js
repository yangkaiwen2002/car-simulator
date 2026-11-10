// Menu preferences are independent of the legacy lap records and driving settings.
export function searchCars(cars, query = '') {
  const words = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return cars.filter(car => {
    const text = `${car.brand} ${car.name} ${car.year || ''} ${car.type}`.normalize('NFKC').toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}

export function parseMenuPreferences(raw, carIds, destinationIds) {
  let saved;
  try { saved = JSON.parse(raw); } catch { return {}; }
  if (!saved || typeof saved !== 'object') return {};
  return {
    car: carIds.includes(saved.car) ? saved.car : undefined,
    destination: destinationIds.includes(saved.destination) ? saved.destination : undefined,
    compactHud: saved.compactHud === true,
  };
}

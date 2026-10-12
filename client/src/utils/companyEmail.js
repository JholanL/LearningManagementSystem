const normalizeNamePart = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '.')
  .replace(/^\.+|\.+$/g, '');

export const buildCompanyEmail = (firstName, lastName) => {
  const parts = [normalizeNamePart(firstName), normalizeNamePart(lastName)].filter(Boolean);
  return parts.length === 2 ? `${parts.join('.')}@voicelink.ph` : '';
};

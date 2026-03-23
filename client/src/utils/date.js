const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parseLocalDate = (value) => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
};

export const formatLocalDateForApi = (value) => {
  const date = parseLocalDate(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
};

export const getLocalDateKey = (value) => formatLocalDateForApi(value);

export const startOfLocalDay = (value) => {
  const date = parseLocalDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const endOfLocalDay = (value) => {
  const date = parseLocalDate(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

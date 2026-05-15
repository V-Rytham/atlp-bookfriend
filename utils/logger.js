/* eslint-disable no-console */
const isDev = process.env.NODE_ENV !== 'production';

export const log = (...args) => {
  if (isDev) console.log(...args);
};

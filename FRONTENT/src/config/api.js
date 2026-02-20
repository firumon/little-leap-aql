const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyHhZTiUIzzF6oXeivlKg1WjPlQAxQ0WTnehVsjDGEV15cG7hRbdAaUvHdusOV4ZM68gA/exec'

export const GAS_URL = (import.meta.env.VITE_GAS_URL || DEFAULT_GAS_URL).trim()
export const GAS_CONTENT_TYPE = 'text/plain'

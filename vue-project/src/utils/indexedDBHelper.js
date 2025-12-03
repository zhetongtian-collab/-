/**
 * IndexedDB 工具模块
 * 用于存储和管理画布图片数据
 */

const DB_NAME = 'CanvasImageDB'
const DB_VERSION = 1
const STORE_NAME = 'images'

let dbInstance = null

/**
 * 初始化数据库
 * @returns {Promise<IDBDatabase>}
 */
export const initDB = () => {
    return new Promise((resolve, reject) => {
        // 如果已经有实例，直接返回
        if (dbInstance) {
            resolve(dbInstance)
            return
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => {
            console.error('IndexedDB 打开失败:', request.error)
            reject(request.error)
        }

        request.onsuccess = () => {
            dbInstance = request.result
            console.log('IndexedDB 初始化成功')
            resolve(dbInstance)
        }

        request.onupgradeneeded = (event) => {
            const db = event.target.result

            // 创建对象存储（如果不存在）
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
                objectStore.createIndex('timestamp', 'timestamp', { unique: false })
                console.log('创建对象存储:', STORE_NAME)
            }
        }
    })
}

/**
 * 保存图片数据
 * @param {string} id - 图片ID
 * @param {Object} imageData - 图片数据对象
 * @param {string} imageData.id - 图片ID
 * @param {number} imageData.x - X坐标
 * @param {number} imageData.y - Y坐标
 * @param {number} imageData.width - 宽度
 * @param {number} imageData.height - 高度
 * @param {Blob} imageData.blob - 图片Blob数据
 * @param {number} imageData.timestamp - 时间戳
 * @returns {Promise<void>}
 */
export const saveImage = async (id, imageData) => {
    try {
        const db = await initDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite')
            const objectStore = transaction.objectStore(STORE_NAME)
            const request = objectStore.put(imageData)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                console.error('保存图片失败:', id, request.error)
                reject(request.error)
            }
        })
    } catch (error) {
        console.error('保存图片时出错:', error)
        throw error
    }
}

/**
 * 批量保存图片数据
 * @param {Array<Object>} imagesData - 图片数据数组
 * @returns {Promise<void>}
 */
export const saveImages = async (imagesData) => {
    try {
        const db = await initDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite')
            const objectStore = transaction.objectStore(STORE_NAME)

            transaction.oncomplete = () => {
                resolve()
            }

            transaction.onerror = () => {
                console.error('批量保存图片失败:', transaction.error)
                reject(transaction.error)
            }

            imagesData.forEach(imageData => {
                objectStore.put(imageData)
            })
        })
    } catch (error) {
        console.error('批量保存图片时出错:', error)
        throw error
    }
}

/**
 * 加载单张图片
 * @param {string} id - 图片ID
 * @returns {Promise<Object|null>}
 */
export const loadImage = async (id) => {
    try {
        const db = await initDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly')
            const objectStore = transaction.objectStore(STORE_NAME)
            const request = objectStore.get(id)

            request.onsuccess = () => {
                resolve(request.result || null)
            }

            request.onerror = () => {
                console.error('加载图片失败:', id, request.error)
                reject(request.error)
            }
        })
    } catch (error) {
        console.error('加载图片时出错:', error)
        throw error
    }
}

/**
 * 加载所有图片
 * @returns {Promise<Array>}
 */
export const loadAllImages = async () => {
    try {
        const db = await initDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly')
            const objectStore = transaction.objectStore(STORE_NAME)
            const request = objectStore.getAll()

            request.onsuccess = () => {
                resolve(request.result || [])
            }

            request.onerror = () => {
                console.error('加载所有图片失败:', request.error)
                reject(request.error)
            }
        })
    } catch (error) {
        console.error('加载所有图片时出错:', error)
        // 返回空数组而不是抛出错误，允许降级到 localStorage
        return []
    }
}

/**
 * 删除图片
 * @param {string} id - 图片ID
 * @returns {Promise<void>}
 */
export const deleteImage = async (id) => {
    try {
        const db = await initDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite')
            const objectStore = transaction.objectStore(STORE_NAME)
            const request = objectStore.delete(id)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                console.error('删除图片失败:', id, request.error)
                reject(request.error)
            }
        })
    } catch (error) {
        console.error('删除图片时出错:', error)
        throw error
    }
}

/**
 * 清空所有图片
 * @returns {Promise<void>}
 */
export const clearAllImages = async () => {
    try {
        const db = await initDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite')
            const objectStore = transaction.objectStore(STORE_NAME)
            const request = objectStore.clear()

            request.onsuccess = () => {
                console.log('已清空所有图片数据')
                resolve()
            }

            request.onerror = () => {
                console.error('清空图片失败:', request.error)
                reject(request.error)
            }
        })
    } catch (error) {
        console.error('清空图片时出错:', error)
        throw error
    }
}

/**
 * 获取所有图片ID
 * @returns {Promise<Array<string>>}
 */
export const getAllImageIds = async () => {
    try {
        const db = await initDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly')
            const objectStore = transaction.objectStore(STORE_NAME)
            const request = objectStore.getAllKeys()

            request.onsuccess = () => {
                resolve(request.result || [])
            }

            request.onerror = () => {
                console.error('获取所有图片ID失败:', request.error)
                reject(request.error)
            }
        })
    } catch (error) {
        console.error('获取所有图片ID时出错:', error)
        return []
    }
}

/**
 * 获取存储的图片数量
 * @returns {Promise<number>}
 */
export const getImageCount = async () => {
    try {
        const db = await initDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly')
            const objectStore = transaction.objectStore(STORE_NAME)
            const request = objectStore.count()

            request.onsuccess = () => {
                resolve(request.result)
            }

            request.onerror = () => {
                console.error('获取图片数量失败:', request.error)
                reject(request.error)
            }
        })
    } catch (error) {
        console.error('获取图片数量时出错:', error)
        return 0
    }
}

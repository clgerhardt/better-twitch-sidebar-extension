export const getStorage = async (key: string) => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(key, (result) => {
      console.log("result", result);
      resolve(result[key]);
    });
  });
}


// export const getStorageLocal = async (key: string) => {
//   return await chrome.storage.sync.get(`${key}`);
// }
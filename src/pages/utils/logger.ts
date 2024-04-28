import { constants } from "./constants";

export const messageLogger = (location: string = constants.location.NOT_SET, message = 'nothing set', obj?: any) => {
  if(import.meta.env.VITE_LOGGER_LEVEL === constants.loggerLevel.DEBUG) {
    if(obj === 0) { obj = "0"; }
    obj ? console.log(`LOGGER: ${location}: ${message} : `, obj) : console.log(`LOGGER: ${location}: ${message}`);
  }
}
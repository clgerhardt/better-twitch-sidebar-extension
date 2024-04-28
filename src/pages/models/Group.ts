import { Channel } from "./Channel";

export type Group = {
  default: boolean;
  order: number;
  groupName: string;
  numberOfChannels: number;
  numberOfLiveChannels: number;
  dialogOpen: boolean;
  dropdownVisible: boolean;
  followedChannels: Channel[];
};
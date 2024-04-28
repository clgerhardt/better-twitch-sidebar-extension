import { Group } from "@src/pages/models/Group";

export interface ErrorState {
  invalid: boolean;
  blank: boolean;
  overCharacterLimit: boolean;
  errorMessages: string[];
}

export interface AddGroupProps {
  groups: string[];
  updateFollowersList: (newGroup: Group)=>void;
}
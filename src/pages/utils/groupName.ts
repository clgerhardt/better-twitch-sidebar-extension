// The rules for a group's name, shared by adding and renaming. No chrome.* imports, so it is tested in
// plain node.
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

export const MIN_GROUP_NAME_LENGTH = 3;
export const MAX_GROUP_NAME_LENGTH = 15;

// English only for now: the word list covers case and leetspeak ("sh1t"), not letters spread out with
// dots or spaces. Built on first use, since most pages never validate a name.
let profanityMatcher: RegExpMatcher | undefined;
const hasProfanity = (name: string) => {
  profanityMatcher ??= new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
  return profanityMatcher.hasMatch(name);
};

// takenLowercase: the other groups' names in lower case (names are unique whatever their capitalisation).
// Returns why the name is not allowed, or null when it is fine.
export const validateGroupName = (name: string, takenLowercase: string[]): string | null => {
  if (name.length === 0) return "Group name cannot be blank";
  if (name.length > MAX_GROUP_NAME_LENGTH) return `Group name cannot be over ${MAX_GROUP_NAME_LENGTH} characters`;
  if (takenLowercase.includes(name.toLowerCase())) return "Group name already exists";
  if (name.length < MIN_GROUP_NAME_LENGTH) return `Group name must be at least ${MIN_GROUP_NAME_LENGTH} characters`;
  if (hasProfanity(name)) return "Group name contains language that isn't allowed";
  return null;
};

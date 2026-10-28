// The rules for a group's name, shared by adding and renaming. No chrome.* imports, so it is tested in
// plain node.
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";
import { tEn, type Translator } from "../shared/i18n/i18n";

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
export const validateGroupName = (name: string, takenLowercase: string[], t: Translator = tEn): string | null => {
  if (name.length === 0) return t("groupName.blank");
  if (name.length > MAX_GROUP_NAME_LENGTH) return t("groupName.tooLong", { max: MAX_GROUP_NAME_LENGTH });
  if (takenLowercase.includes(name.toLowerCase())) return t("groupName.exists");
  if (name.length < MIN_GROUP_NAME_LENGTH) return t("groupName.tooShort", { min: MIN_GROUP_NAME_LENGTH });
  if (hasProfanity(name)) return t("groupName.profanity");
  return null;
};

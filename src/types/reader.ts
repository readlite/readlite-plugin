/**
 * Reader related types
 */
import { ThemeType } from "~/config/theme";
import { LanguageCode } from "~/utils/language";

export interface ReaderSettings {
  theme: ThemeType;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textAlign: string;
  width: number;
}

export interface Article {
  title?: string;
  byline?: string;
  content?: string;
}

export interface ReaderContentProps {
  settings: ReaderSettings;
  article: Article | null;
  detectedLanguage: LanguageCode;
  error: string | null;
}

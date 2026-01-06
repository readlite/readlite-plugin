/**
 * Unit tests for language detection utilities
 */

import {
  normalizeLanguageCode,
  isChineseLanguage,
  isLanguageSupported,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
} from "./language";

describe("Language Utils", () => {
  describe("normalizeLanguageCode", () => {
    describe("handles ISO 639-3 codes (from franc-min)", () => {
      it("normalizes 'cmn' to 'zh' (Mandarin Chinese)", () => {
        expect(normalizeLanguageCode("cmn")).toBe("zh");
      });

      it("normalizes 'wuu' to 'zh' (Wu Chinese)", () => {
        expect(normalizeLanguageCode("wuu")).toBe("zh");
      });

      it("normalizes 'yue' to 'zh' (Cantonese)", () => {
        expect(normalizeLanguageCode("yue")).toBe("zh");
      });

      it("normalizes 'eng' to 'en' (English)", () => {
        expect(normalizeLanguageCode("eng")).toBe("en");
      });

      it("normalizes 'jpn' to 'ja' (Japanese)", () => {
        expect(normalizeLanguageCode("jpn")).toBe("ja");
      });

      it("normalizes 'kor' to 'ko' (Korean)", () => {
        expect(normalizeLanguageCode("kor")).toBe("ko");
      });

      it("normalizes 'fra' to 'fr' (French)", () => {
        expect(normalizeLanguageCode("fra")).toBe("fr");
      });

      it("normalizes 'deu' to 'de' (German)", () => {
        expect(normalizeLanguageCode("deu")).toBe("de");
      });

      it("normalizes 'spa' to 'es' (Spanish)", () => {
        expect(normalizeLanguageCode("spa")).toBe("es");
      });

      it("normalizes 'ita' to 'it' (Italian)", () => {
        expect(normalizeLanguageCode("ita")).toBe("it");
      });

      it("normalizes 'rus' to 'ru' (Russian)", () => {
        expect(normalizeLanguageCode("rus")).toBe("ru");
      });
    });

    describe("handles regional variants", () => {
      it("normalizes 'zh-CN' to 'zh'", () => {
        expect(normalizeLanguageCode("zh-CN")).toBe("zh");
      });

      it("normalizes 'zh-TW' to 'zh'", () => {
        expect(normalizeLanguageCode("zh-TW")).toBe("zh");
      });

      it("normalizes 'zh-HK' to 'zh'", () => {
        expect(normalizeLanguageCode("zh-HK")).toBe("zh");
      });

      it("normalizes 'en-US' to 'en'", () => {
        expect(normalizeLanguageCode("en-US")).toBe("en");
      });

      it("normalizes 'en-GB' to 'en'", () => {
        expect(normalizeLanguageCode("en-GB")).toBe("en");
      });

      it("normalizes 'en-CA' to 'en'", () => {
        expect(normalizeLanguageCode("en-CA")).toBe("en");
      });

      it("normalizes 'en-AU' to 'en'", () => {
        expect(normalizeLanguageCode("en-AU")).toBe("en");
      });
    });

    describe("handles unknown regional codes by extracting base", () => {
      it("extracts base code from 'fr-CA'", () => {
        expect(normalizeLanguageCode("fr-CA")).toBe("fr");
      });

      it("extracts base code from 'de-AT'", () => {
        expect(normalizeLanguageCode("de-AT")).toBe("de");
      });

      it("extracts base code from 'es-MX'", () => {
        expect(normalizeLanguageCode("es-MX")).toBe("es");
      });
    });

    describe("handles case insensitivity", () => {
      it("handles uppercase 'ENG'", () => {
        expect(normalizeLanguageCode("ENG")).toBe("en");
      });

      it("handles mixed case 'Zh-Cn'", () => {
        expect(normalizeLanguageCode("Zh-Cn")).toBe("zh");
      });

      it("handles uppercase 'EN-US'", () => {
        expect(normalizeLanguageCode("EN-US")).toBe("en");
      });
    });

    describe("handles edge cases", () => {
      it("returns DEFAULT_LANGUAGE for null", () => {
        expect(normalizeLanguageCode(null)).toBe(DEFAULT_LANGUAGE);
      });

      it("returns DEFAULT_LANGUAGE for undefined", () => {
        expect(normalizeLanguageCode(undefined)).toBe(DEFAULT_LANGUAGE);
      });

      it("returns DEFAULT_LANGUAGE for empty string", () => {
        expect(normalizeLanguageCode("")).toBe(DEFAULT_LANGUAGE);
      });

      it("returns original code for unknown codes", () => {
        expect(normalizeLanguageCode("xyz")).toBe("xyz");
      });

      it("returns standard 2-letter codes as-is", () => {
        expect(normalizeLanguageCode("en")).toBe("en");
        expect(normalizeLanguageCode("zh")).toBe("zh");
        expect(normalizeLanguageCode("ja")).toBe("ja");
      });
    });
  });

  describe("isChineseLanguage", () => {
    it("returns true for 'zh'", () => {
      expect(isChineseLanguage("zh")).toBe(true);
    });

    it("returns true for 'cmn' (Mandarin)", () => {
      expect(isChineseLanguage("cmn")).toBe(true);
    });

    it("returns true for 'yue' (Cantonese)", () => {
      expect(isChineseLanguage("yue")).toBe(true);
    });

    it("returns true for 'wuu' (Wu)", () => {
      expect(isChineseLanguage("wuu")).toBe(true);
    });

    it("returns true for 'zh-CN'", () => {
      expect(isChineseLanguage("zh-CN")).toBe(true);
    });

    it("returns true for 'zh-TW'", () => {
      expect(isChineseLanguage("zh-TW")).toBe(true);
    });

    it("returns true for 'zh-HK'", () => {
      expect(isChineseLanguage("zh-HK")).toBe(true);
    });

    it("returns false for 'en'", () => {
      expect(isChineseLanguage("en")).toBe(false);
    });

    it("returns false for 'ja'", () => {
      expect(isChineseLanguage("ja")).toBe(false);
    });

    it("returns false for 'ko'", () => {
      expect(isChineseLanguage("ko")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isChineseLanguage(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isChineseLanguage(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isChineseLanguage("")).toBe(false);
    });
  });

  describe("isLanguageSupported", () => {
    it("returns true for all SUPPORTED_LANGUAGES", () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(isLanguageSupported(lang)).toBe(true);
      });
    });

    it("returns true for 'en'", () => {
      expect(isLanguageSupported("en")).toBe(true);
    });

    it("returns true for 'zh'", () => {
      expect(isLanguageSupported("zh")).toBe(true);
    });

    it("returns true for 'ja'", () => {
      expect(isLanguageSupported("ja")).toBe(true);
    });

    it("returns true for 'ko'", () => {
      expect(isLanguageSupported("ko")).toBe(true);
    });

    it("returns true for ISO 639-3 codes that normalize to supported languages", () => {
      expect(isLanguageSupported("eng")).toBe(true);
      expect(isLanguageSupported("cmn")).toBe(true);
      expect(isLanguageSupported("jpn")).toBe(true);
    });

    it("returns false for unsupported languages", () => {
      expect(isLanguageSupported("xyz")).toBe(false);
      expect(isLanguageSupported("abc")).toBe(false);
    });
  });

  describe("Constants", () => {
    it("DEFAULT_LANGUAGE is 'en'", () => {
      expect(DEFAULT_LANGUAGE).toBe("en");
    });

    it("SUPPORTED_LANGUAGES contains expected languages", () => {
      expect(SUPPORTED_LANGUAGES).toContain("en");
      expect(SUPPORTED_LANGUAGES).toContain("zh");
      expect(SUPPORTED_LANGUAGES).toContain("ja");
      expect(SUPPORTED_LANGUAGES).toContain("ko");
      expect(SUPPORTED_LANGUAGES).toContain("fr");
      expect(SUPPORTED_LANGUAGES).toContain("de");
      expect(SUPPORTED_LANGUAGES).toContain("es");
      expect(SUPPORTED_LANGUAGES).toContain("it");
      expect(SUPPORTED_LANGUAGES).toContain("ru");
    });
  });
});

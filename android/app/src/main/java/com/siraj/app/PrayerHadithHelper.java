package com.siraj.app;

import android.content.Context;
import android.util.Log;
import java.util.Locale;

/**
 * Shared Helper for authentic Prayer Hadith text and translations
 * across Urdu, English, and Gujarati for Android native notifications.
 */
public final class PrayerHadithHelper {
    private static final String TAG = "PrayerHadithHelper";
    public static final String PREFS_NAME = "noor_connect_prefs";
    public static final String KEY_HADITH_LANG = "prayer_hadith_lang";

    private PrayerHadithHelper() {
        // Utility class
    }

    public static String getHadithLanguage(Context context) {
        if (context == null) return "ur";
        try {
            String lang = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getString(KEY_HADITH_LANG, "ur");
            if ("hi".equals(lang)) {
                return "en";
            }
            return lang;
        } catch (Throwable t) {
            Log.w(TAG, "Failed to read prayer_hadith_lang from SharedPreferences", t);
            return "ur";
        }
    }

    public static void setHadithLanguage(Context context, String lang) {
        if (context == null) return;
        try {
            String target = "ur";
            if ("hi".equals(lang) || "en".equals(lang)) {
                target = "en";
            } else if ("gu".equals(lang) || "ur".equals(lang)) {
                target = lang;
            }
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_HADITH_LANG, target)
                    .apply();
            Log.i(TAG, "Updated prayer notification Hadith language preference to: " + target);
        } catch (Throwable t) {
            Log.w(TAG, "Failed to persist prayer_hadith_lang in SharedPreferences", t);
        }
    }

    public static String getPrayerHadith(Context context, String prayerName) {
        String lang = getHadithLanguage(context);
        return getPrayerHadith(prayerName, lang);
    }

    public static String getHadithCitation(String prayerName, String lang) {
        String targetLang = (lang != null && (lang.equals("en") || lang.equals("gu") || lang.equals("ur")))
                ? lang
                : ("hi".equals(lang) ? "en" : "ur");
        String p = (prayerName != null) ? prayerName.toLowerCase(Locale.ROOT).trim() : "fajr";

        if ("dhuhr".equals(p)) {
            if ("ur".equals(targetLang)) return "صحیح مسلم 233";
            if ("gu".equals(targetLang)) return "મુસ્લિમ 233";
            return "Muslim 233";
        } else if ("jummah".equals(p)) {
            if ("ur".equals(targetLang)) return "صحیح مسلم 854";
            if ("gu".equals(targetLang)) return "મુસ્લિમ 854";
            return "Muslim 854";
        } else if ("asr".equals(p)) {
            if ("ur".equals(targetLang)) return "صحیح بخاری 574";
            if ("gu".equals(targetLang)) return "બુખારી 574";
            return "Bukhari 574";
        } else if ("maghrib".equals(p)) {
            if ("ur".equals(targetLang)) return "ابو داؤد 418";
            if ("gu".equals(targetLang)) return "અબૂ દાઊદ 418";
            return "Abu Dawud 418";
        } else if ("isha".equals(p)) {
            if ("ur".equals(targetLang)) return "صحیح مسلم 656";
            if ("gu".equals(targetLang)) return "મુસ્લિમ 656";
            return "Muslim 656";
        } else if ("sunrise".equals(p)) {
            if ("ur".equals(targetLang)) return "صحیح مسلم 748";
            if ("gu".equals(targetLang)) return "મુસ્લિમ 748";
            return "Muslim 748";
        }

        // Fajr & default
        if ("ur".equals(targetLang)) return "صحیح بخاری 527";
        if ("gu".equals(targetLang)) return "બુખારી 527";
        return "Bukhari 527";
    }

    public static String stripTrailingHadithRef(String text) {
        if (text == null) return "";
        return text.replaceAll("\\s*[\\(\\[（](?:Bukhari|Muslim|Abu Dawud|Dawud|Tirmidhi|Nasai|Ibn Majah|صحیح بخاری|صحیح مسلم|بخاری|مسلم|ابو داؤد|ترمذی|نسائی|ابن ماجہ|બુખારી|મુસ્લિમ|અબૂ દાઊદ|તિરમિઝી|નસાઈ|ઇબ્ને માજહ)[\\s\\d\\w/\\.\\-]*[\\)\\]）]\\s*$", "").trim();
    }

    public static String getPrayerHadith(String prayerName, String lang) {
        String targetLang = (lang != null && (lang.equals("en") || lang.equals("gu") || lang.equals("ur")))
                ? lang
                : ("hi".equals(lang) ? "en" : "ur");
        String p = (prayerName != null) ? prayerName.toLowerCase(Locale.ROOT).trim() : "fajr";
        String quote;

        if ("fajr".equals(p)) {
            if ("ur".equals(targetLang)) {
                quote = "«الصَّلَاةُ فِي وَقْتِهَا» — ”اللّٰہ تعالیٰ کے نزدیک سب سے محبوب عمل نماز کو اس کے اول وقت پر ادا کرنا ہے۔“";
            } else if ("gu".equals(targetLang)) {
                quote = "«الصَّلَاةُ فِي وَقْتِهَا» — “અલ્લાહ તઆલાને સૌથી વધુ પ્રિય અમલ નમાઝને તેના નિર્ધારિત પ્રથમ સમયે અદા કરવી છે.”";
            } else {
                quote = "«الصَّلَاةُ فِي وَقْتِهَا» — “The deed most beloved to Allah is prayer offered at its earliest appointed time.”";
            }
        } else if ("dhuhr".equals(p) || "jummah".equals(p)) {
            if ("ur".equals(targetLang)) {
                quote = "«حَافِظُوا عَلَى الصَّلَوَاتِ» — ”اپنی فرض نمازوں کی پابندی کرو، پانچوں نمازیں ان گناہوں کا کفارہ بن جاتی ہیں جو ان کے درمیان ہوں۔“";
            } else if ("gu".equals(targetLang)) {
                quote = "«હાલફિઝૂ અલસ્સલવાત» — “તમારી ફરઝ નમાઝોની પાબંદી કરો, પાંચેય નમાઝો તેમની વચ્ચે થયેલા ગુનાહોનું કફ્ફારો બની જાય છે.”";
            } else {
                quote = "«حَافِظُوا عَلَى الصَّلَوَاتِ» — “Guard strictly your five obligatory prayers; the five daily prayers wipe out sins committed between them.”";
            }
        } else if ("asr".equals(p)) {
            if ("ur".equals(targetLang)) {
                quote = "«مَنْ صَلَّى الْبَرْدَيْنِ دَخَلَ الْجَنَّةَ» — ”جو شخص دو ٹھنڈے وقتوں (فجر اور عصر) کی نماز پابندی سے پڑھے گا وہ جنت میں داخل ہوگا۔“";
            } else if ("gu".equals(targetLang)) {
                quote = "«મન સલ્લા અલ-બરદૈન» — “જે વ્યક્તિ બે ઠંડા સમયો (ફજર અને અસર)ની નમાઝ પઢશે તે જન્નતમાં દાખલ થશે.”";
            } else {
                quote = "«مَنْ صَلَّى الْبَرْدَيْنِ دَخَلَ الْجَنَّةَ» — “Whoever prays the two cool prayers (Fajr and Asr) on time will enter Paradise.”";
            }
        } else if ("maghrib".equals(p)) {
            if ("ur".equals(targetLang)) {
                quote = "«أَقِمِ الصَّلَاةَ لِدُلُوكِ الشَّمْسِ» — ”میری امت اس وقت تک بھلائی اور فطرت پر رہے گی جب تک وہ مغرب کی نماز میں تاخیر نہ کرے۔“";
            } else if ("gu".equals(targetLang)) {
                quote = "«અકિમિસ સલાત» — “મારી ઉમ્મત ત્યાં સુધી ભલાઈ પર રહેશે જ્યાં સુધી તેઓ મગરિબની નમાઝમાં વિલંબ નહીં કરે.”";
            } else {
                quote = "«أَقِمِ الصَّلَاةَ لِدُلُوكِ الشَّمْسِ» — “My Ummah will remain upon goodness as long as they do not delay the Maghrib prayer.”";
            }
        } else if ("isha".equals(p)) {
            if ("ur".equals(targetLang)) {
                quote = "«مَنْ صَلَّى الْعِشَاءَ فِي جَمَاعَةٍ» — ”جس نے عشاء کی نماز باجماعت ادا کی، گویا اس نے آدھی رات تک قیام کیا۔“";
            } else if ("gu".equals(targetLang)) {
                quote = "«મન સલ્લા અલ-ઇશા» — “જેણે ઈશાની નમાઝ જમાઅત સાથે અદા કરી, જાણે તેણે અડધી રાત સુધી ઇબાદત કરી.”";
            } else {
                quote = "«مَنْ صَلَّى الْعِشَاءَ فِي جَمَاعَةٍ» — “Whoever prays Isha in congregation, it is as if he stood in prayer for half the night.”";
            }
        } else {
            // Generic / Sunrise fallback
            if ("ur".equals(targetLang)) {
                quote = "«الصَّلَاةُ فِي وَقْتِهَا» — ”اللّٰہ تعالیٰ کے نزدیک سب سے محبوب عمل نماز کو اس کے اول وقت پر ادا کرنا ہے۔“";
            } else if ("gu".equals(targetLang)) {
                quote = "«الصَّلَاةُ فِي وَقْتِهَا» — “અલ્લાહ તઆલાને સૌથી વધુ પ્રિય અમલ નમાઝને તેના નિર્ધારિત પ્રથમ સમયે અદા કરવી છે.”";
            } else {
                quote = "«الصَّلَاةُ فِي وَقْتِهَا» — “The deed most beloved to Allah is prayer offered at its earliest appointed time.”";
            }
        }

        String cleanQuote = stripTrailingHadithRef(quote);
        String citation = getHadithCitation(prayerName, targetLang);
        return cleanQuote + "\n— " + citation;
    }
}

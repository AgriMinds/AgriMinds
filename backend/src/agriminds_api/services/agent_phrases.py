"""What the farmer agent says, in the three languages the platform speaks.

The advisory engine emits English prose only. Chat and voice could translate in the browser, but
the 977 hotline has no browser: an SMS reply has to be composed server-side or it goes out in a
language the farmer may not read. So the phrasing lives here.

These are not free translations of the engine's sentences. The engine picks its action text from a
fixed table keyed by risk level, so the same key selects the Amharic and Afaan Oromoo wording --
there is a finite set of things it can say, and this is that set in three languages. English reuses
the engine's own sentence verbatim, so the chat answer and the dashboard card cannot drift apart.

Keeping the numbers out of the templates is deliberate: a probability or a plot name interpolated
at the end cannot be mistranslated.
"""

from __future__ import annotations

from typing import Literal

Locale = Literal["en", "am", "or"]
RiskLevel = Literal["Low", "Moderate", "High", "Severe"]

#: Headline for "what is my risk". `{plot}`, `{crop}`, `{pct}`, `{level}` are filled in.
RISK: dict[Locale, str] = {
    "en": "{plot} ({crop}): {pct}% chance of drought — {level}.",
    "am": "{plot} ({crop}): የድርቅ ዕድል {pct}% — {level}።",
    "or": "{plot} ({crop}): carraa hongee {pct}% — {level}.",
}

LEVEL: dict[Locale, dict[RiskLevel, str]] = {
    "en": {"Low": "Low", "Moderate": "Moderate", "High": "High", "Severe": "Severe"},
    "am": {"Low": "ዝቅተኛ", "Moderate": "መካከለኛ", "High": "ከፍተኛ", "Severe": "በጣም ከፍተኛ"},
    "or": {"Low": "Gadi aanaa", "Moderate": "Giddu galeessa", "High": "Ol aanaa", "Severe": "Hamaa"},
}

#: Planting advice by risk level — the engine's `planting` action, in three languages.
PLANTING: dict[Locale, dict[RiskLevel, str]] = {
    "en": {},  # English comes from the engine itself; see `AgentService._engine_text`.
    "am": {
        "Low": "በመደበኛ የዝናብ መጀመሪያ ይዝሩ። ለመሃር/ክረምት ከሐምሌ መጀመሪያ እስከ አጋማሽ።",
        "Moderate": "ዝናቡ እንደጀመረ ወዲያውኑ ይዝሩ፤ የዘገየ ዝረት የወቅት መጨረሻ ድርቅን አያመልጥም።",
        "High": "ዝረትን በማሳዎች መካከል ያከፋፍሉ፤ አፈሩ በቂ እርጥበት እስኪይዝ (ከ25 ሚሜ በላይ ዝናብ) ያዘግዩ።",
        "Severe": "እርጥበቱ እስኪመለስ ዝረትን ያቆዩ፤ በተጋላጭ ቁልቁለቶች የሚታረስውን መሬት ይቀንሱ።",
    },
    "or": {
        "Low": "Jalqaba roobaa idilee irratti facaasi. Meher/Kiremt'f Adoolessa jalqabaa hanga walakkaa.",
        "Moderate": "Akkuma roobni jalqabe battalumatti facaasi; facaasuu tursiisuun hongee waqtii dhumaa hin oolchu.",
        "High": "Facaasuu lafa gidduutti qoodi; hanga lafti jiidha gahaa qabaatutti (rooba 25mm ol) tursiisi.",
        "Severe": "Hanga jiidhi deebi'utti facaasuu dhiisi; lafa gaara irraa qotamu hir'isi.",
    },
}

WATER: dict[Locale, dict[RiskLevel, str]] = {
    "en": {},
    "am": {
        "Low": "መደበኛ የዝናብ ውሃ ማቆር (ኮንቱር እርሻ፣ መሸፈኛ) ይጠቀሙ።",
        "Moderate": "ጥቃቅን የውሃ ማጠራቀሚያዎችን፣ በቦታው የውሃ አሰባሰብና ተጨማሪ መስኖ ያዘጋጁ።",
        "High": "በእድገትና በአበባ ወቅት ላይ ያተኮረ የተገደበ መስኖ መርሐ ግብር ይጀምሩ።",
        "Severe": "ያለውን ውሃ ለቤት አካባቢና ለችግኝ ማሳዎች ብቻ ይመድቡ።",
    },
    "or": {
        "Low": "Bishaan roobaa idileedhaan kuusi (qotiisa konteerii, uwwisa).",
        "Moderate": "Kuusaa bishaan xiqqaa, walitti qabaa bishaanii fi jallisii dabalataa qopheessi.",
        "High": "Sagantaa jallisii hir'ataa yeroo guddinaa fi daraaraa irratti xiyyeeffate jalqabi.",
        "Severe": "Bishaan jiru lafa mana jirenyaa fi biqiltuuf qofa ramadi.",
    },
}

CROP: dict[Locale, dict[RiskLevel, str]] = {
    "en": {},
    "am": {
        "Low": "የተመረጠውን የተረጋገጠ ዘር ዝርያ ይቀጥሉ። መደበኛው የግብርና ጥቅል ይሠራል።",
        "Moderate": "ፈጥነው የሚደርሱና ድርቅን የሚያመልጡ ዝርያዎችን ያስቀድሙ። ዘር ማዘጋጀትን ያስቡ።",
        "High": "የተረጋገጡ ድርቅ መቋቋም የሚችሉ ዝርያዎችን ይጠቀሙ (ለጤፍ ኩንቾ/ቦሰት)። በቆሎ ካለ በጤፍ ወይም በማሽላ ይቀይሩ።",
        "Severe": "ወደ አጭር ጊዜ ሰብሎች፣ ጥራጥሬ ወይም ድርቅ ተቋቋሚ ጤፍ ይቀይሩ። የበቆሎ ስፋት ይቀንሱ።",
    },
    "or": {
        "Low": "Sanyii mirkanaa'e karoorfame itti fufi. Pakeejiin qonnaa idilee hojjeta.",
        "Moderate": "Sanyii dafee bilchaatu kan hongee oolchu filadhu. Sanyii qopheessuu yaadi.",
        "High": "Sanyii hongee dandamachuu danda'u fayyadami (xaafiif Quncho/Boset). Boqqolloo yoo qabaatte xaafii yookaan mishingaatti jijjiiri.",
        "Severe": "Midhaan yeroo gabaabaa, atara yookaan xaafii hongee dandamatutti jijjiiri. Bal'ina boqqolloo hir'isi.",
    },
}

PREP: dict[Locale, dict[RiskLevel, str]] = {
    "en": {},
    "am": {
        "Low": "መደበኛ የግብዓት ስርጭትና በልማት ሠራተኞች በኩል የአየር ሁኔታ ክትትል።",
        "Moderate": "የየአስር ቀኑን የአየር ሁኔታ መረጃ ይከታተሉ፤ ከቀበሌ ልማት ሠራተኛ ጋር ይተባበሩ።",
        "High": "የእንስሳት መኖ ያዘጋጁ፣ የዞኑን የአደጋ መከላከል ግብረ ኃይል ያሳውቁ፣ የእህል ቋት ይጀምሩ።",
        "Severe": "የድርቅ መከላከል ሥርዓትን ያስነሱ፣ የድጋፍ መረብ ይጠይቁ፣ የዘር አቅርቦት ያስተባብሩ።",
    },
    "or": {
        "Low": "Raabsaa meeshaa idilee fi hordoffii haala qilleensaa hojjettoota misoomaatiin.",
        "Moderate": "Odeeffannoo haala qilleensaa guyyaa kudhanii hordofi; hojjetaa misooma gandaa waliin hojjedhu.",
        "High": "Soorata horii qopheessi, humna ittisa balaa godinaa beeksisi, kuusaa midhaanii jalqabi.",
        "Severe": "Sirna ittisa hongee kakaasi, deeggarsa gaafadhu, dhiyeessii sanyii qindeessi.",
    },
}

#: The menu an SMS or voice caller gets, and the chat's opening line.
MENU: dict[Locale, str] = {
    "en": "AgriMinds {code}. Reply: 1 drought risk, 2 when to plant, 3 water, 4 which seed, 5 my plots, 6 the season.",
    "am": "አግሪማይንድስ {code}። መልስ፡ 1 የድርቅ ስጋት፣ 2 መቼ መዝራት፣ 3 ውሃ፣ 4 ምን ዘር፣ 5 ማሳዎቼ፣ 6 ወቅቱ።",
    "or": "AgriMinds {code}. Deebisi: 1 hongee, 2 yoom facaasuu, 3 bishaan, 4 sanyii kam, 5 lafa koo, 6 waqtii.",
}

PLOTS: dict[Locale, str] = {
    "en": "Your plots: {list}.",
    "am": "ማሳዎችዎ፡ {list}።",
    "or": "Lafa kee: {list}.",
}

SEASON: dict[Locale, str] = {
    "en": "{season}, targeting {month}. Pacific now: {enso}.",
    "am": "{season}፣ ዒላማው {month}። የፓስፊክ ሁኔታ፡ {enso}።",
    "or": "{season}, kaayyoo {month}. Haala Paasifiik: {enso}.",
}

NO_PLOTS: dict[Locale, str] = {
    "en": "No plot is registered to this number yet. Ask your kebele development agent to add one.",
    "am": "በዚህ ቁጥር የተመዘገበ ማሳ የለም። የቀበሌ ልማት ሠራተኛዎን እንዲያስገባ ይጠይቁ።",
    "or": "Lafti lakkoofsa kanaan galmeeffame hin jiru. Hojjetaa misooma gandaa akka galchuuf gaafadhu.",
}

UNKNOWN_CALLER: dict[Locale, str] = {
    "en": "This number is not registered with AgriMinds. Ask your development agent to register you.",
    "am": "ይህ ቁጥር በአግሪማይንድስ አልተመዘገበም። የልማት ሠራተኛዎ እንዲመዘግብዎ ይጠይቁ።",
    "or": "Lakkoofsi kun AgriMinds biratti hin galmoofne. Hojjetaan misoomaa akka si galmeessu gaafadhu.",
}

MODEL_DOWN: dict[Locale, str] = {
    "en": "The forecast is unavailable right now. Try again later — no advice is better than wrong advice.",
    "am": "ትንበያው አሁን አይገኝም። ቆይተው ይሞክሩ — የተሳሳተ ምክር ከመስጠት አለመስጠት ይሻላል።",
    "or": "Tilmaamni amma hin argamu. Booda yaali — gorsa dogoggoraa kennuu irra dhiisuu wayya.",
}

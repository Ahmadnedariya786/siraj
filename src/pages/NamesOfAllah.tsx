import { useState, useMemo, useCallback, memo } from 'react';
import { AppBar } from '@/components/AppBar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/PageTransition';
import { ContentLanguageBar } from '@/components/ContentLanguageBar';
import { Search, Heart, Sparkles } from 'lucide-react';
import { useContentLanguage, type ContentLang } from '@/lib/content-translator';
import {
  NAMES_OF_ALLAH,
  NAMES_UI_I18N,
  type AsmaNameItem,
} from '@/components/NamesOfAllahData';
import { NamesDetailModal } from '@/components/NamesDetailModal';

const FAVORITES_KEY = 'names-of-allah-favorites';

function loadInitialFavorites(): number[] {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch (err) {
    console.debug('[NamesOfAllah] Failed to read favorites:', err);
    return [];
  }
}

interface NameCardRowProps {
  item: AsmaNameItem;
  contentLang: ContentLang;
  isFavorite: boolean;
  favLabel: string;
  onSelect: (item: AsmaNameItem) => void;
  onToggleFavorite: (number: number) => void;
}

const NameCardRow = memo<NameCardRowProps>(({
  item,
  contentLang,
  isFavorite,
  favLabel,
  onSelect,
  onToggleFavorite,
}) => {
  const isUrdu = contentLang === 'ur';
  const localized = item[contentLang] || item.en;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className="w-full min-h-[96px] rounded-2xl overflow-hidden border flex items-stretch cursor-pointer active:scale-[0.99] transition-transform duration-150 select-none text-left"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'inset 0 1px 0 var(--card-sheen-line, var(--card-sheen)), 0 6px 18px rgba(0, 0, 0, 0.22)',
      }}
    >
      {/* Left Info Section */}
      <div className="flex-1 min-w-0 p-4 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            dir="ltr"
            className="text-xs font-bold w-7 h-7 rounded-lg flex items-center justify-center shrink-0 tabular-nums font-serif"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
          >
            {item.number}
          </span>
          <h3
            dir="ltr"
            className="font-bold text-base sm:text-lg font-serif truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {item.transliteration}
          </h3>
        </div>
        <p
          dir={isUrdu ? 'rtl' : 'ltr'}
          className={`text-xs font-medium leading-snug break-words ${
            isUrdu ? 'font-urdu text-right text-[14px] leading-[2.0]' : 'text-left'
          }`}
          style={{ color: 'var(--text-secondary)' }}
        >
          {localized.meaning}
        </p>
      </div>

      {/* Right Arabic Section */}
      <div
        className="w-[124px] shrink-0 flex flex-col items-center justify-center py-3 px-2 relative"
        style={{
          background: 'var(--surface-2)',
          borderInlineStart: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          aria-label={`${favLabel} ${item.transliteration}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.number);
          }}
          className="absolute top-1.5 end-1.5 z-10 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
        >
          <Heart
            className={`w-4 h-4 ${
              isFavorite
                ? 'fill-[var(--accent)] text-[var(--accent)]'
                : 'text-[var(--text-secondary)]'
            }`}
          />
        </button>

        <span
          dir="rtl"
          className="text-2xl sm:text-3xl font-arabic font-bold leading-[1.8] py-1 px-1 text-center"
          style={{
            color: 'var(--text-primary)',
            letterSpacing: '0px',
          }}
        >
          {item.arabic}
        </span>
      </div>
    </div>
  );
});

NameCardRow.displayName = 'NameCardRow';

export default function NamesOfAllah() {
  const { contentLang } = useContentLanguage();
  const isUrdu = contentLang === 'ur';
  const ui = NAMES_UI_I18N[contentLang] || NAMES_UI_I18N.en;

  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<number[]>(loadInitialFavorites);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

  const toggleFavorite = useCallback((number: number) => {
    setFavorites((prev) => {
      const next = prev.includes(number)
        ? prev.filter((n) => n !== number)
        : [...prev, number];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch (err) {
        console.debug('[NamesOfAllah] Failed to persist favorites:', err);
      }
      return next;
    });
  }, []);

  const filteredNames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return NAMES_OF_ALLAH.filter((item) => {
      const matchesSearch =
        !q ||
        String(item.number) === q ||
        item.transliteration.toLowerCase().includes(q) ||
        item.en.meaning.toLowerCase().includes(q) ||
        item.ur.meaning.includes(searchQuery.trim()) ||
        item.gu.meaning.includes(searchQuery.trim()) ||
        item.arabic.includes(searchQuery.trim());

      if (showFavoritesOnly) {
        return matchesSearch && favorites.includes(item.number);
      }
      return matchesSearch;
    });
  }, [searchQuery, showFavoritesOnly, favorites]);

  const activeList = filteredNames.length > 0 ? filteredNames : NAMES_OF_ALLAH;

  const selectedIndex = useMemo(() => {
    if (selectedNumber === null) return -1;
    return activeList.findIndex((n) => n.number === selectedNumber);
  }, [activeList, selectedNumber]);

  const selectedName = useMemo(() => {
    if (selectedNumber === null) return null;
    return NAMES_OF_ALLAH.find((n) => n.number === selectedNumber) || null;
  }, [selectedNumber]);

  const handleSelectName = useCallback((item: AsmaNameItem) => {
    setSelectedNumber(item.number);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedNumber(null);
  }, []);

  const handlePrevName = useCallback(() => {
    if (activeList.length === 0 || selectedNumber === null) return;
    const idx = activeList.findIndex((n) => n.number === selectedNumber);
    const prevIdx = idx <= 0 ? activeList.length - 1 : idx - 1;
    setSelectedNumber(activeList[prevIdx].number);
  }, [activeList, selectedNumber]);

  const handleNextName = useCallback(() => {
    if (activeList.length === 0 || selectedNumber === null) return;
    const idx = activeList.findIndex((n) => n.number === selectedNumber);
    const nextIdx = idx < 0 || idx >= activeList.length - 1 ? 0 : idx + 1;
    setSelectedNumber(activeList[nextIdx].number);
  }, [activeList, selectedNumber]);

  return (
    <PageTransition>
      <div
        className="min-h-screen w-full max-w-full overflow-x-hidden pb-6 relative z-10"
        style={{ background: 'transparent' }}
      >
        <AppBar title={ui.pageTitle} showBack />

        <div className="max-w-lg mx-auto px-4 pt-3 space-y-4">
          {/* 3-Language Selector Pill (EN / اردو / ગુજરાતી) */}
          <div className="flex justify-center">
            <ContentLanguageBar compact />
          </div>

          {/* Hero Card (opaque surface gradients, zero blur blobs) */}
          <div
            className="relative overflow-hidden rounded-[28px] p-6 border text-center flex flex-col items-center"
            style={{
              background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)',
              borderColor: 'var(--border)',
              boxShadow: 'inset 0 1px 0 var(--card-sheen-line, var(--card-sheen)), 0 10px 28px rgba(0, 0, 0, 0.32)',
            }}
          >
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.16em] border mb-2.5"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'var(--border)',
                color: 'var(--accent-text)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className={isUrdu ? 'font-urdu tracking-normal text-sm' : ''}>
                {ui.badge}
              </span>
            </div>

            <h1
              dir="rtl"
              className="text-3xl sm:text-4xl font-arabic font-bold leading-tight mt-0.5"
              style={{ color: 'var(--text-primary)', letterSpacing: '0px' }}
            >
              {ui.arabicHeader}
            </h1>

            <p
              dir={isUrdu ? 'rtl' : 'ltr'}
              className={`text-xs sm:text-sm mt-2 max-w-xs leading-relaxed ${
                isUrdu ? 'font-urdu text-[15px] leading-[2.1]' : 'font-serif italic'
              }`}
              style={{ color: 'var(--text-secondary)' }}
            >
              {ui.heroSub}
            </p>
          </div>

          {/* Search & Favorites Filter Bar */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <div
                className="absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Search className="w-4 h-4" />
              </div>
              <Input
                placeholder={ui.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                dir={isUrdu ? 'rtl' : 'ltr'}
                className={`ps-10 h-11 rounded-2xl font-medium ${isUrdu ? 'font-urdu text-sm' : ''}`}
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              aria-label={ui.favoritesFilterLabel}
              aria-pressed={showFavoritesOnly}
              className="h-11 w-11 shrink-0 rounded-2xl border"
              style={{
                background: showFavoritesOnly
                  ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)'
                  : 'var(--surface)',
                borderColor: showFavoritesOnly ? 'transparent' : 'var(--border)',
                color: showFavoritesOnly ? 'var(--on-accent)' : 'var(--text-secondary)',
              }}
              onClick={() => setShowFavoritesOnly((prev) => !prev)}
            >
              <Heart
                className={`w-5 h-5 ${showFavoritesOnly ? 'fill-current' : ''}`}
                style={{ color: showFavoritesOnly ? 'var(--on-accent)' : 'var(--text-secondary)' }}
              />
            </Button>
          </div>

          {/* All 99 Names rendered immediately with stable heights (zero motion wrapper or intersection hiding) */}
          <div className="grid grid-cols-1 gap-3">
            {filteredNames.map((item) => (
              <NameCardRow
                key={item.number}
                item={item}
                contentLang={contentLang}
                isFavorite={favorites.includes(item.number)}
                favLabel={ui.favoritesFilterLabel}
                onSelect={handleSelectName}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>

          {filteredNames.length === 0 && (
            <div className="text-center py-16">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 border"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <Search className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} />
              </div>
              <p
                dir={isUrdu ? 'rtl' : 'ltr'}
                className={`text-sm font-medium ${isUrdu ? 'font-urdu' : ''}`}
                style={{ color: 'var(--text-secondary)' }}
              >
                {ui.noMatches}
              </p>
              <Button
                type="button"
                variant="link"
                className={`mt-2 font-bold ${isUrdu ? 'font-urdu' : ''}`}
                style={{ color: 'var(--accent-text)' }}
                onClick={() => {
                  setSearchQuery('');
                  setShowFavoritesOnly(false);
                }}
              >
                {ui.clearFilters}
              </Button>
            </div>
          )}
        </div>

        {/* Portal-rendered Name Detail Modal (mounted on document.body at zIndex 9999) */}
        <NamesDetailModal
          selectedName={selectedName}
          contentLang={contentLang}
          isFavorite={selectedName ? favorites.includes(selectedName.number) : false}
          onClose={handleCloseModal}
          onToggleFavorite={toggleFavorite}
          onPrev={handlePrevName}
          onNext={handleNextName}
          totalCount={activeList.length}
          currentIndex={selectedIndex}
        />
      </div>
    </PageTransition>
  );
}

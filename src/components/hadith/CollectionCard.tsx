import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookIcon, Users } from "lucide-react";
import { HadithCollection } from "@/data/hadith-collections";
import { useContentLanguage, translateIslamicText } from "@/lib/content-translator";
import { formatCollectionHadithCount, formatCompilerLifespan } from "@/lib/hadith-utils";

interface CollectionCardProps {
  collection: HadithCollection;
  onClick: () => void;
}

export function CollectionCard({ collection, onClick }: CollectionCardProps) {
  const { contentLang, isRtl } = useContentLanguage();
  const [desc, setDesc] = useState(collection.description);

  useEffect(() => {
    if (contentLang === 'en') {
      setDesc(collection.description);
      return;
    }
    let active = true;
    translateIslamicText(collection.description, contentLang).then((t) => {
      if (active) setDesc(t);
    });
    return () => { active = false; };
  }, [collection.description, contentLang]);

  const countsText = formatCollectionHadithCount(collection.totalHadith, collection.totalNarrations);
  const lifespanText = formatCompilerLifespan(collection.compilerPeriod, collection.death);

  return (
    <Card
      className="group cursor-pointer border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40"
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5 space-y-3.5">
        {/* Header with Icon */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] border border-[var(--border)] transition-colors shrink-0">
              <BookIcon className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
                className="font-bold text-base sm:text-lg text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors line-clamp-2 leading-tight break-words"
              >
                {collection.title}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-arabic truncate" dir="rtl">
                {collection.arabicTitle}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] shrink-0 border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent-text)] font-medium">
            {collection.authenticity}
          </Badge>
        </div>

        {/* Description */}
        <p
          className={`text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3 ${isRtl ? 'font-urdu text-right' : 'text-left'}`}
          dir="auto"
          style={{ unicodeBidi: 'plaintext' }}
        >
          {desc}
        </p>

        {/* Canonical Counts & Books Metadata */}
        <div className="space-y-2 pt-1">
          <div className="flex items-start gap-2 text-xs text-[var(--text-primary)]">
            <Users className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
            <span className="font-semibold leading-snug break-words">{countsText}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <BookIcon className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
            <span className="font-semibold text-[var(--text-primary)]">{collection.totalBooks}</span> Books
          </div>
        </div>

        {/* Author & Single Lifespan */}
        <div className="pt-2.5 border-t border-[var(--border)]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{collection.author}</p>
              {lifespanText && (
                <p className="text-[11px] font-mono text-[var(--text-secondary)] truncate">{lifespanText}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-[var(--accent-text)] font-medium">Explore</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

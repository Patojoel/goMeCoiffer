import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { t } from '@/lib/i18n/i18n';

export function NotFound() {
  return (
    <section className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t('notFound.title')}</h1>
      <p className="text-muted-foreground">{t('notFound.hint')}</p>
      <Link to="/" className={buttonVariants()}>
        {t('common.backHome')}
      </Link>
    </section>
  );
}

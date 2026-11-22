import type { ReactNode } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export type EmptyStateProps = {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      {action}
    </Card>
  );
}

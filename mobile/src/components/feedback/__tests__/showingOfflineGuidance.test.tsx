import { t } from '@gomecoiffer/client-core';
import { render, screen } from '@testing-library/react-native';
import { OfflineBanner } from '../offline-banner';

describe('Offline network guidance (RG-013-17)', () => {
  it('shows the offline guidance banner when the device has no network', async () => {
    await render(<OfflineBanner isOnline={false} />);

    expect(screen.getByText(t('common.offlineBanner'))).toBeOnTheScreen();
  });

  it('hides the offline guidance banner when the network is available', async () => {
    await render(<OfflineBanner isOnline={true} />);

    expect(screen.queryByText(t('common.offlineBanner'))).not.toBeOnTheScreen();
  });
});

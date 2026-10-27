import { redirect } from 'next/navigation';

/** The Settings page has been removed. */
export default function SettingsPage() {
  redirect('/dashboard');
}

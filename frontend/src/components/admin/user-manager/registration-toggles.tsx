interface Props {
  registrationsOpen: boolean;
  togglingReg: boolean;
  onToggleRegistrations: () => void;
  demoRegOpen: boolean;
  togglingDemoReg: boolean;
  onToggleDemoRegistrations: () => void;
}

export function RegistrationToggles({
  registrationsOpen,
  togglingReg,
  onToggleRegistrations,
  demoRegOpen,
  togglingDemoReg,
  onToggleDemoRegistrations,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
        <div>
          <span className="text-sm font-medium text-zinc-200">
            User Registrations
          </span>
          <p className="text-xs text-zinc-500 mt-0.5">
            Allow new users to sign up
          </p>
        </div>
        <button
          type="button"
          disabled={togglingReg}
          aria-label={
            registrationsOpen
              ? 'Disable user registrations'
              : 'Enable user registrations'
          }
          onClick={onToggleRegistrations}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${registrationsOpen ? 'bg-green-600' : 'bg-zinc-600'} ${togglingReg ? 'opacity-50' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${registrationsOpen ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
        <div>
          <span className="text-sm font-medium text-zinc-200">
            Demo Accounts
          </span>
          <p className="text-xs text-zinc-500 mt-0.5">
            Allow one-click demo account creation
          </p>
        </div>
        <button
          type="button"
          disabled={togglingDemoReg}
          aria-label={
            demoRegOpen
              ? 'Disable demo accounts'
              : 'Enable demo accounts'
          }
          onClick={onToggleDemoRegistrations}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${demoRegOpen ? 'bg-green-600' : 'bg-zinc-600'} ${togglingDemoReg ? 'opacity-50' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${demoRegOpen ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
      </div>
    </div>
  );
}

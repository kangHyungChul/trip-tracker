import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
    return <label className="field">{label}{children}</label>;
}

export function Row2({ children }: { children: ReactNode }) {
    return <div className="grid grid-cols-2 gap-x-3.5 max-phone:grid-cols-1">{children}</div>;
}

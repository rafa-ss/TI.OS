import clsx from 'clsx';

export default function Badge({ children, className, color }) {
  return (
    <span className={clsx('badge', color, className)}>{children}</span>
  );
}

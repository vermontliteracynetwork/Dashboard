interface Props {
  remaining: number;
  total: number;
  label?: string;
}

export default function TicketStub({ remaining, total, label = 'left to go' }: Props) {
  if (total <= 1) return null;
  return (
    <span className="ticket-stub">
      🎫 {remaining} {label} ({total - remaining}/{total} done)
    </span>
  );
}

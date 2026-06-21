import { ErrorState } from "@/components/ui/ErrorState";

type ErrorMessageProps = {
  message: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
  return <ErrorState message={message} title="Request failed" />;
}

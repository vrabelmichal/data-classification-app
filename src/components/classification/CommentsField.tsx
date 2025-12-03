interface CommentsFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CommentsField({ value, onChange, disabled = false }: CommentsFieldProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
        Comments
      </h4>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add any observations or comments..."
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
        rows={3}
      />
    </div>
  );
}

import React from 'react';
import { parseVisionDescription } from '../../utils/formatVisionDescription';

interface VisionDescriptionProps {
  description: string;
  className?: string;
}

export const VisionDescription: React.FC<VisionDescriptionProps> = ({
  description,
  className = '',
}) => {
  const parsed = parseVisionDescription(description);

  if (parsed.sections.length === 0) {
    return (
      <p className={`text-sm text-surface-700 leading-relaxed ${className}`.trim()}>
        {parsed.plain}
      </p>
    );
  }

  return (
    <div className={`space-y-4 text-sm text-surface-700 ${className}`.trim()}>
      {parsed.intro && <p className="leading-relaxed text-surface-800">{parsed.intro}.</p>}

      {parsed.sections.map((section) => (
        <div
          key={section.title}
          className="rounded-lg border border-surface-200 bg-surface-50/80 p-4 space-y-2"
        >
          <h4 className="text-sm font-semibold text-surface-900">{section.title}</h4>

          {section.lead && <p className="leading-relaxed">{section.lead}</p>}

          {section.body && <p className="leading-relaxed">{section.body}</p>}

          {section.bullets.length > 0 && (
            <ul className="list-disc list-inside space-y-1 pl-1 text-surface-700">
              {section.bullets.map((item) => (
                <li key={item} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

export default VisionDescription;

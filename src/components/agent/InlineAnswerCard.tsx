/**
 * Inline Answer Card Component
 * Implements selection-first lens paradigm with inline answer cards near selections
 * Shows ≤2 sentence answers with [sid:xxxx] citations and follow-up questions
 */

import React, { useState, useEffect, useRef } from 'react';
import { InlineAnswerCard as InlineAnswerCardType, SentenceAnchor } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('inline-answer-card');

interface InlineAnswerCardProps {
  card: InlineAnswerCardType;
  onClose: () => void;
  onFollowUpQuestion: (question: string) => void;
  onCitationHover: (citationId: string) => void;
  onCitationLeave: () => void;
}

export const InlineAnswerCard: React.FC<InlineAnswerCardProps> = ({
  card,
  onClose,
  onFollowUpQuestion,
  onCitationHover,
  onCitationLeave
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-close on ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Position the card near the selection
  useEffect(() => {
    if (cardRef.current) {
      const rect = card.position.anchor.range.getBoundingClientRect();
      const cardElement = cardRef.current;
      
      // Calculate position to avoid going off-screen
      let left = rect.right + 10;
      let top = rect.top;
      
      // Check right boundary
      if (left + cardElement.offsetWidth > window.innerWidth) {
        left = rect.left - cardElement.offsetWidth - 10;
      }
      
      // Check bottom boundary
      if (top + cardElement.offsetHeight > window.innerHeight) {
        top = rect.bottom - cardElement.offsetHeight;
      }
      
      // Ensure card stays on screen
      left = Math.max(10, Math.min(left, window.innerWidth - cardElement.offsetWidth - 10));
      top = Math.max(10, Math.min(top, window.innerHeight - cardElement.offsetHeight - 10));
      
      cardElement.style.left = `${left}px`;
      cardElement.style.top = `${top}px`;
    }
  }, [card]);

  // Handle citation hover
  const handleCitationHover = (citationId: string) => {
    onCitationHover(citationId);
  };

  const handleCitationLeave = () => {
    onCitationLeave();
  };

  // Render citation with hover effect
  const renderCitation = (citation: string) => {
    const citationId = citation.replace(/[\[\]]/g, '');
    
    return (
      <span
        key={citationId}
        className="inline-citation"
        onMouseEnter={() => handleCitationHover(citationId)}
        onMouseLeave={handleCitationLeave}
      >
        {citation}
      </span>
    );
  };

  // Render confidence indicator
  const renderConfidenceIndicator = () => {
    const confidenceColors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${confidenceColors[card.confidence]}`}>
        {card.confidence.charAt(0).toUpperCase() + card.confidence.slice(1)} confidence
      </span>
    );
  };

  // Render numeric card if available
  const renderNumericCard = () => {
    if (!card.numericCard) return null;

    return (
      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-semibold text-lg">{card.numericCard.value}</div>
          {card.numericCard.unit && (
            <div className="text-blue-700">{card.numericCard.unit}</div>
          )}
          {card.numericCard.rowLabel && (
            <div className="text-blue-600">Row: {card.numericCard.rowLabel}</div>
          )}
          {card.numericCard.columnLabel && (
            <div className="text-blue-600">Column: {card.numericCard.columnLabel}</div>
          )}
        </div>
      </div>
    );
  };

  // Render follow-up questions
  const renderFollowUpQuestions = () => {
    if (!isExpanded || card.followUpQuestions.length === 0) return null;

    return (
      <div className="mt-4 space-y-2">
        <div className="text-sm font-medium text-gray-700">Follow-up questions:</div>
        <div className="space-y-2">
          {card.followUpQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => onFollowUpQuestion(question)}
              className="block w-full text-left p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={cardRef}
      className="fixed z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-h-96 overflow-y-auto"
      style={{ position: 'absolute' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="text-sm text-gray-500 mb-1">Answer to:</div>
          <div className="text-sm font-medium text-gray-900 line-clamp-2">
            {card.question}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Answer */}
      <div className="mb-3">
        <div className="text-sm text-gray-900 leading-relaxed">
          {card.answer}
        </div>
        
        {/* Citations */}
        {card.citations.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            Sources: {card.citations.map(renderCitation)}
          </div>
        )}
      </div>

      {/* Confidence indicator */}
      <div className="mb-3">
        {renderConfidenceIndicator()}
      </div>

      {/* Numeric card */}
      {renderNumericCard()}

      {/* Expand/collapse button */}
      {card.followUpQuestions.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-3 p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200 transition-colors"
        >
          {isExpanded ? 'Show less' : `Show ${card.followUpQuestions.length} follow-up questions`}
        </button>
      )}

      {/* Follow-up questions */}
      {renderFollowUpQuestions()}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
        Press ESC to close • Click citations to highlight source
      </div>
    </div>
  );
};

export default InlineAnswerCard;
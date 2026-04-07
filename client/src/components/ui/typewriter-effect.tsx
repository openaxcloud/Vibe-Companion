import React, { useEffect, useState } from 'react';
import { LazyMotionSpan } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface TypewriterEffectProps {
  text: string;
  className?: string;
  speed?: number;
  cursor?: boolean;
  onComplete?: () => void;
}

export function TypewriterEffect({
  text,
  className,
  speed = 50,
  cursor = true,
  onComplete
}: TypewriterEffectProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span className={cn('inline-flex items-center', className)}>
      {displayedText}
      {cursor && (
        <LazyMotionSpan
          animate={{ opacity: isTyping ? [1, 0] : 0 }}
          transition={{
            duration: 0.5,
            repeat: isTyping ? Infinity : 0,
            repeatType: 'reverse'
          }}
          className="ml-1 inline-block w-[2px] h-[1.2em] bg-current"
        />
      )}
    </span>
  );
}

interface StaggeredTextProps {
  text: string;
  className?: string;
  staggerDelay?: number;
}

export function StaggeredText({
  text,
  className,
  staggerDelay = 0.03
}: StaggeredTextProps) {
  const words = text.split(' ');

  return (
    <LazyMotionSpan className={className}>
      {words.map((word, wordIndex) => (
        <LazyMotionSpan
          key={wordIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: wordIndex * staggerDelay * 5,
            duration: 0.3
          }}
          className="inline-block mr-1"
        >
          {word.split('').map((char, charIndex) => (
            <LazyMotionSpan
              key={`${wordIndex}-${charIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: wordIndex * staggerDelay * 5 + charIndex * staggerDelay,
                duration: 0.2
              }}
              className="inline-block"
            >
              {char}
            </LazyMotionSpan>
          ))}
        </LazyMotionSpan>
      ))}
    </LazyMotionSpan>
  );
}
import React from 'react';
import { LazyMotionDiv } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  initialDelay = 0
}: StaggerContainerProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: initialDelay,
        staggerChildren: staggerDelay
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: 'easeOut'
      }
    }
  };

  return (
    <LazyMotionDiv
      className={cn('w-full', className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {React.Children.map(children, (child, index) => (
        <LazyMotionDiv key={index} variants={itemVariants}>
          {child}
        </LazyMotionDiv>
      ))}
    </LazyMotionDiv>
  );
}

interface FadeInStaggerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
}

export function FadeInStagger({
  children,
  className,
  delay = 0,
  duration = 0.5,
  once = true
}: FadeInStaggerProps) {
  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once }}
      transition={{
        delay,
        duration,
        ease: 'easeOut'
      }}
      className={className}
    >
      {children}
    </LazyMotionDiv>
  );
}

interface ScaleStaggerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function ScaleStagger({
  children,
  className,
  staggerDelay = 0.05
}: ScaleStaggerProps) {
  return (
    <div className={cn('grid gap-4', className)}>
      {React.Children.map(children, (child, index) => (
        <LazyMotionDiv
          key={index}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: index * staggerDelay,
            duration: 0.3,
            type: 'spring',
            stiffness: 200,
            damping: 20
          }}
          whileHover={{ scale: 1.02 }}
          className="card-lift"
        >
          {child}
        </LazyMotionDiv>
      ))}
    </div>
  );
}
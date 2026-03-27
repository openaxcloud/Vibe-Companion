import { motion, AnimatePresence } from "framer-motion";

export const LazyMotionDiv = motion.div;
export const LazyAnimatePresence = AnimatePresence;
export { AnimatePresence };
export const CSSFade = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const CSSSlide = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const fadeVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
export const staggerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

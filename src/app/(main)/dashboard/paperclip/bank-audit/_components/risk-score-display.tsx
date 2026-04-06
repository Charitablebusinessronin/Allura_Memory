/**
 * Risk Score Display Component
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Visual risk score indicator with threshold markers
 */

'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface RiskScoreDisplayProps {
  score: number; // 0 to 1
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get risk level from score
 */
function getRiskLevel(score: number): {
  level: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
} {
  if (score >= 0.85) {
    return {
      level: 'critical',
      label: 'Critical',
      color: 'text-red-600',
      bgColor: 'bg-red-600',
      icon: <XCircle className="h-5 w-5" />,
    };
  }
  if (score >= 0.70) {
    return {
      level: 'high',
      label: 'High',
      color: 'text-orange-600',
      bgColor: 'bg-orange-600',
      icon: <AlertTriangle className="h-5 w-5" />,
    };
  }
  if (score >= 0.50) {
    return {
      level: 'medium',
      label: 'Medium',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-600',
      icon: <Info className="h-5 w-5" />,
    };
  }
  return {
    level: 'low',
    label: 'Low',
    color: 'text-green-600',
    bgColor: 'bg-green-600',
    icon: <CheckCircle2 className="h-5 w-5" />,
  };
}

/**
 * Get size classes
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return {
        container: 'gap-2',
        score: 'text-sm font-medium',
        badge: 'text-xs',
        progress: 'h-2',
      };
    case 'lg':
      return {
        container: 'gap-3',
        score: 'text-3xl font-bold',
        badge: 'text-sm',
        progress: 'h-4',
      };
    default:
      return {
        container: 'gap-2',
        score: 'text-lg font-bold',
        badge: 'text-xs',
        progress: 'h-3',
      };
  }
}

/**
 * Get badge variant
 */
function getBadgeVariant(level: 'low' | 'medium' | 'high' | 'critical'): "destructive" | "default" | "secondary" | "outline" {
  switch (level) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
  }
}

export function RiskScoreDisplay({ 
  score, 
  showLabel = true, 
  size = 'md' 
}: RiskScoreDisplayProps) {
  const risk = getRiskLevel(score);
  const sizeClasses = getSizeClasses(size);
  const percentage = Math.round(score * 100);

  return (
    <div className={`flex items-center ${sizeClasses.container}`}>
      {/* Icon */}
      <div className={risk.color}>
        {risk.icon}
      </div>

      {/* Score */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className={sizeClasses.score}>
            {percentage}%
          </span>
          {showLabel && (
            <Badge variant={getBadgeVariant(risk.level)} className={sizeClasses.badge}>
              {risk.label} Risk
            </Badge>
          )}
        </div>
        
        {/* Progress Bar */}
        <div className="relative">
          <Progress 
            value={percentage} 
            className={`${sizeClasses.progress} bg-muted`}
          />
          
          {/* Threshold Markers */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {/* Medium threshold (50%) */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-yellow-500 opacity-50"
              style={{ left: '50%' }}
            />
            
            {/* High threshold (70%) */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-orange-500 opacity-50"
              style={{ left: '70%' }}
            />
            
            {/* Critical threshold (85%) */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-red-500 opacity-50"
              style={{ left: '85%' }}
            />
          </div>
        </div>

        {/* Threshold Labels */}
        {size === 'lg' && (
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>Safe</span>
            <span>Medium (50%)</span>
            <span>High (70%)</span>
            <span>Critical (85%)</span>
          </div>
        )}
      </div>
    </div>
  );
}
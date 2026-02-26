/**
 * 檔案名稱: features/stage-player/components/stages/practice/VariableBalancer.tsx
 * 功能描述: 變數平衡器 (Variable Balancer) - 練習組件
 * 
 * 用於理解多變數之間動態關係 (如公式、生態平衡) 的組件。
 * 
 * 互動邏輯:
 * 1. 提供多個可調整的滑桿 (Sliders) 代表變數。
 * 2. 使用者調整變數以達成特定的平衡目標 (Target State)。
 */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot
} from 'recharts';
import { motion } from 'framer-motion';
import { LessonStage } from '@/types/lesson';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import * as math from 'mathjs';

// Simple Slider Component
const SimpleSlider = ({ value, min, max, onChange, className }: any) => (
    <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
        className={clsx("w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700", className)}
    />
);

interface VariableBalancerProps {
    stage: LessonStage;
    onComplete: (success: boolean) => void;
}

export const VariableBalancer: React.FC<VariableBalancerProps> = ({ stage, onComplete }) => {
    const { config, validation, feedback } = stage;
    const [xVal, setXVal] = useState(config.initialState.x || 0);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    // [MODIFIED] Dynamic Equation Parsing with mathjs
    // Default equation is x^2 if not provided
    const equationStr = (config.data.equation || "x^2").replace('=', ''); // simple cleanup

    // Compile expressions once if possible, but inside memo is fine
    const compiledEquation = useMemo(() => {
        try {
            return math.compile(equationStr);
        } catch (e) {
            console.error("Invalid equation:", equationStr, e);
            return math.compile("x^2"); // Fallback
        }
    }, [equationStr]);

    // Identify the primary variable (e.g., 'price' or 'x')
    const primaryVar = (config.data.variables && config.data.variables[0]) ? config.data.variables[0] : 'x';

    // Construct base scope from initial state (for other variables)
    // e.g. { supply: 50 }
    const baseScope = useMemo(() => {
        const s = { ...config.initialState };
        // Ensure x is available as fallback
        if (s.x === undefined) s.x = 0;
        return s;
    }, [config.initialState]);

    // Generate Graph Data
    const data = useMemo(() => {
        const points = [];
        const range = config.data.xRange || [-10, 10];
        const [min, max] = range;

        for (let i = min; i <= max; i += (max - min) / 50) { // varying step size
            try {
                // Dynamic scope: Primary var varies, others stay static
                const scope = { ...baseScope, [primaryVar]: i };

                // Allow 'x' to work even if primary is 'price' for generic equations assuming f(x)
                if (primaryVar !== 'x') scope.x = i;

                const y = compiledEquation.evaluate(scope);
                points.push({ x: i, y: y });
            } catch (e) {
                points.push({ x: i, y: 0 });
            }
        }
        return points;
    }, [compiledEquation, config.data.xRange, baseScope, primaryVar]);

    // Calculate Slope
    const currentSlope = useMemo(() => {
        const h = 0.001;
        try {
            const scopePlus = { ...baseScope, [primaryVar]: xVal + h };
            const scopeMinus = { ...baseScope, [primaryVar]: xVal - h };

            if (primaryVar !== 'x') {
                scopePlus.x = xVal + h;
                scopeMinus.x = xVal - h;
            }

            const yPlus = compiledEquation.evaluate(scopePlus);
            const yMinus = compiledEquation.evaluate(scopeMinus);
            return (yPlus - yMinus) / (2 * h);
        } catch { return 0; }
    }, [compiledEquation, xVal, baseScope, primaryVar]);

    // Tangent Line Data
    const tangentData = useMemo(() => {
        const points = [];
        const range = config.data.xRange || [-10, 10];
        const [startX, endX] = range;

        try {
            const currentScope = { ...baseScope, [primaryVar]: xVal };
            if (primaryVar !== 'x') currentScope.x = xVal;

            const y1 = compiledEquation.evaluate(currentScope);

            points.push({ x: startX, tangent: currentSlope * (startX - xVal) + y1 });
            points.push({ x: endX, tangent: currentSlope * (endX - xVal) + y1 });
        } catch { }

        return points;
    }, [compiledEquation, currentSlope, xVal, config.data.xRange, baseScope, primaryVar]);

    // Current Y Value
    const currentY = useMemo(() => {
        try {
            const scope = { ...baseScope, [primaryVar]: xVal };
            if (primaryVar !== 'x') scope.x = xVal;
            return compiledEquation.evaluate(scope);
        } catch { return 0; }
    }, [compiledEquation, xVal, baseScope, primaryVar]);


    // Validation Check
    useEffect(() => {
        if (!validation || !validation.condition || validation.condition.x === undefined || validation.condition.x === null) {
            return;
        }

        // Simple tolerance check
        if (Math.abs(xVal - validation.condition.x) < 0.15) {
            if (!isCorrect) {
                setIsCorrect(true);
                onComplete(true);
            }
        } else {
            setIsCorrect(false);
        }
    }, [xVal, validation, isCorrect, onComplete]);

    return (
        <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">{config.data.title}</h2>
            <p className="text-gray-500 mb-6">{config.data.description}</p>
            <div className="text-xs font-mono text-slate-400 mb-2">Equation: y = {equationStr}</div>

            <div className="h-64 w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
                        <XAxis dataKey="x" type="number" domain={config.data.xRange} allowDataOverflow />
                        <YAxis type="number" domain={['auto', 'auto']} allowDataOverflow />
                        <Tooltip />
                        {/* Main Curve */}
                        <Line data={data} type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                        {/* Tangent Line */}
                        <Line data={tangentData} type="linear" dataKey="tangent" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} strokeDasharray="5 5" />
                        <ReferenceDot x={xVal} y={currentY} r={6} fill="#ef4444" stroke="none" />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-4 mb-4">
                <span className="font-mono font-bold w-12 text-right">x = {xVal.toFixed(1)}</span>
                <SimpleSlider
                    min={(config.data.xRange || [-10, 10])[0]}
                    max={(config.data.xRange || [-10, 10])[1]}
                    value={xVal}
                    onChange={setXVal}
                />
            </div>

            <div className="flex items-center gap-4 mb-2">
                <span className="font-mono text-sm text-gray-600">Slope (m) ≈ {currentSlope.toFixed(2)}</span>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: isCorrect ? 1 : 0, y: isCorrect ? 0 : 10 }}
                className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700"
            >
                <Check className="w-5 h-5" />
                <span className="font-medium">{feedback.success}</span>
            </motion.div>
        </div>
    );
};

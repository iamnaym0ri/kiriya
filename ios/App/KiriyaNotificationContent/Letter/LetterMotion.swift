import CoreGraphics
import Foundation

/// Easing and springs as plain functions of time, so every frame of the letter is a pure function
/// of the clock (LetterPose) and can be rendered, tuned and checked one frame at a time.
enum LetterMotion {
    static func clamp01(_ x: Double) -> Double { min(1, max(0, x)) }

    /// 0 before `start`, 1 after `end`, linear between.
    static func progress(_ t: Double, _ start: Double, _ end: Double) -> Double {
        guard end > start else { return t >= end ? 1 : 0 }
        return clamp01((t - start) / (end - start))
    }

    static func lerp(_ a: CGFloat, _ b: CGFloat, _ u: Double) -> CGFloat { a + (b - a) * CGFloat(u) }
    static func lerp(_ a: Double, _ b: Double, _ u: Double) -> Double { a + (b - a) * u }
    static func lerp(_ a: CGPoint, _ b: CGPoint, _ u: Double) -> CGPoint {
        CGPoint(x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u))
    }

    /// CSS-style cubic-bezier(x1, y1, x2, y2) evaluated at u.
    static func bezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ u: Double) -> Double {
        let u = clamp01(u)
        if u == 0 || u == 1 { return u }
        func curve(_ s: Double, _ p1: Double, _ p2: Double) -> Double {
            let v = 1 - s
            return 3 * v * v * s * p1 + 3 * v * s * s * p2 + s * s * s
        }
        func slope(_ s: Double, _ p1: Double, _ p2: Double) -> Double {
            let v = 1 - s
            return 3 * v * v * p1 + 6 * v * s * (p2 - p1) + 3 * s * s * (1 - p2)
        }
        var s = u
        for _ in 0..<8 {
            let x = curve(s, x1, x2) - u
            let d = slope(s, x1, x2)
            if abs(x) < 1e-6 { break }
            if abs(d) < 1e-6 { break }
            s = clamp01(s - x / d)
        }
        // A few bisection steps in case Newton wandered.
        var lo = 0.0, hi = 1.0
        for _ in 0..<12 where abs(curve(s, x1, x2) - u) > 1e-5 {
            s = (lo + hi) / 2
            if curve(s, x1, x2) < u { lo = s } else { hi = s }
        }
        return curve(s, y1, y2)
    }

    /// The site's --ease-out.
    static func easeOut(_ u: Double) -> Double { bezier(0.2, 0.8, 0.2, 1, u) }
    /// The site's --ease-in-out.
    static func easeInOut(_ u: Double) -> Double { bezier(0.65, 0, 0.35, 1, u) }
    /// A gentle in-out for travel.
    static func glide(_ u: Double) -> Double { bezier(0.45, 0, 0.25, 1, u) }
    /// Gravity-like: slow to start, then falling.
    static func easeIn(_ u: Double) -> Double { bezier(0.5, 0, 0.9, 0.5, u) }

    /// An underdamped spring from 0 to 1, `t` seconds after it starts (0 before).
    /// `response` is the period in seconds, `damping` the damping ratio (< 1 overshoots).
    static func spring(_ t: Double, response: Double, damping: Double) -> Double {
        guard t > 0 else { return 0 }
        let w0 = 2 * Double.pi / response
        let z = min(damping, 0.999)
        let wd = w0 * (1 - z * z).squareRoot()
        let decay = exp(-z * w0 * t)
        return 1 - decay * (cos(wd * t) + (z * w0 / wd) * sin(wd * t))
    }

    /// 0 → 1 → 0 over u in 0...1, smooth at both ends.
    static func bump(_ u: Double) -> Double {
        let u = clamp01(u)
        return sin(Double.pi * u) * sin(Double.pi * u)
    }

    /// A smooth 0...1 wave with the given period (s) and phase (0...1).
    static func wave(_ t: Double, period: Double, phase: Double = 0) -> Double {
        0.5 - 0.5 * cos(2 * Double.pi * (t / period + phase))
    }
}

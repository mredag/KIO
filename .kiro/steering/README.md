# Steering Files - Overview

This directory contains steering rules that guide Kiro's behavior when working on this project.

## ⭐ START HERE: ULTIMATE_GUIDE.md

**The ULTIMATE_GUIDE.md is your single source of truth.** It contains:
- Top 3 critical bug patterns with instant solutions
- Quick decision tree (symptom → solution)
- Essential commands (copy-paste ready)
- Implementation checklists
- Key code patterns
- Deployment steps
- Troubleshooting quick fixes

**For 95% of tasks, the Ultimate Guide is all you need.** Only dive into detailed files for complex scenarios.

## 📚 Additional Steering Files

Only 2 additional files for specific scenarios:

**ui-ux-testing.md** 🎨
- Puppeteer testing workflow and server management
- Viewport testing (mobile, tablet, desktop)
- Accessibility checks and verification steps
- Database persistence testing

**deployment-raspberry-pi.md** 🚀
- Remove test files before build
- NODE_ENV=production requirement
- Port configuration (3001 in prod)
- Network portability and verification checklist

---



## 🎯 Quick Decision Tree

| Symptom | File to Check |
|---------|---------------|
| Empty `{}` in database | ULTIMATE_GUIDE.md → Pattern 1 |
| Content not updating | ULTIMATE_GUIDE.md → Pattern 2 |
| Property undefined | ULTIMATE_GUIDE.md → Pattern 3 |
| Server won't start | ULTIMATE_GUIDE.md → Commands |
| Any error | ULTIMATE_GUIDE.md → Decision Tree |
| UI testing needed | ui-ux-testing.md |
| Deploying to Pi | deployment-raspberry-pi.md |

---

## 📁 File Structure

```
.kiro/steering/
├── ULTIMATE_GUIDE.md          ⭐ START HERE (95% of tasks)
├── README.md                  📖 This file
├── ui-ux-testing.md          🎨 Puppeteer testing (when needed)
└── deployment-raspberry-pi.md 🚀 Pi deployment (when needed)
```

**That's it!** Just 4 files total. Everything else is consolidated into ULTIMATE_GUIDE.md.

---

## ✅ Best Practices

**DO:**
- Start with ULTIMATE_GUIDE.md for any task
- Use detailed files only when needed
- Update steering files when discovering new patterns
- Follow the checklists before/after coding

**DON'T:**
- Skip the Ultimate Guide
- Create new documentation files (unless requested)
- Ignore the decision tree
- Repeat solved problems

---

## 🔄 Maintenance

**When to Update:**
- New critical bug pattern discovered
- New solution found for common issue
- Process improvement identified

**How to Update:**
1. Add to ULTIMATE_GUIDE.md if critical (top 3 patterns)
2. Add to detailed file if comprehensive info needed
3. Update decision tree in README if new symptom
4. Test the solution before documenting

---

## ✨ Success Metrics

These steering files have solved:
- ✅ Async setState bugs (empty survey answers)
- ✅ Hardcoded content (questions not updating)
- ✅ Data transformation errors (property access)
- ✅ Server startup issues (port conflicts)
- ✅ Database persistence problems
- ✅ UI/UX regressions
- ✅ Deployment issues (Pi)

**Result:** 100% test pass rate, production-ready system

---

**Last Updated:** 2025-11-28  
**Status:** ✅ Streamlined and optimized  
**Total Files:** 4 (1 ultimate + 2 specialized + 1 readme)  
**Coverage:** All critical patterns consolidated

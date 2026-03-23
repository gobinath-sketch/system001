const Course = require('../models/Course');

exports.recommendCourses = async (req, res) => {
    try {
        const { technology, query } = req.query;
        let techFilter = {};

        if (technology) {
            techFilter.technology = new RegExp(technology, 'i');
        }

        // Step 1: Fetch all courses for the selected technology
        const allTechCourses = await Course.find(techFilter);

        if (!query || query.trim() === '') {
            // No query — return full tech list
            return res.status(200).json(
                allTechCourses.map(c => ({ ...c.toObject(), matchType: 'all', relevanceScore: 0 }))
            );
        }

        const normalizedQuery = query.trim().toLowerCase();

        // Step 2: Exact match — courseName or courseCode equals query (case-insensitive)
        const exactMatches = allTechCourses.filter(c =>
            c.courseName.toLowerCase() === normalizedQuery ||
            c.courseCode.toLowerCase() === normalizedQuery
        );

        if (exactMatches.length > 0) {
            return res.status(200).json(
                exactMatches.map(c => ({ ...c.toObject(), matchType: 'exact', relevanceScore: 100 }))
            );
        }

        // Step 3: Keyword-based fallback with relevance scoring
        // Extract meaningful keywords (length > 2), ignoring common stop words
        const stopWords = new Set(['the', 'and', 'for', 'with', 'using', 'from', 'into', 'that', 'this']);
        const keywords = normalizedQuery
            .split(/[\s,\-\/]+/)
            .filter(w => w.length > 2 && !stopWords.has(w));

        if (keywords.length === 0) {
            // Very short query — return full tech list
            return res.status(200).json(
                allTechCourses.map(c => ({ ...c.toObject(), matchType: 'all', relevanceScore: 0 }))
            );
        }

        // Score each course by number of keyword hits in courseName + courseCode
        const scored = allTechCourses
            .map(c => {
                const searchText = `${c.courseName} ${c.courseCode}`.toLowerCase();
                const score = keywords.reduce((acc, kw) => {
                    // Count how many times the keyword appears (gives more weight to repeated matches)
                    const regex = new RegExp(kw, 'gi');
                    const hits = (searchText.match(regex) || []).length;
                    return acc + hits;
                }, 0);
                return { course: c, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score);

        if (scored.length > 0) {
            return res.status(200).json(
                scored.map(({ course, score }) => ({
                    ...course.toObject(),
                    matchType: 'keyword',
                    relevanceScore: score
                }))
            );
        }

        // Step 4: No matches at all — return empty so UI shows "Manual entry active"
        return res.status(200).json([]);

    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).json({ message: 'Error fetching courses', error: err.message });
    }
};

exports.getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.status(200).json(courses);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching courses', error: err.message });
    }
};

const Course = require('../models/Course');

exports.recommendCourses = async (req, res) => {
    try {
        const { technology, query } = req.query;
        let queryObj = {};

        if (technology) {
            // Match technology flexibly (e.g. if passed 'IBM', match 'IBM')
            queryObj.technology = new RegExp(technology, 'i');
        }

        let courses = [];
        if (query && query.trim() !== '') {
            // 1. Try Exact Match on query
            const exactSearchQuery = query.trim();
            const exactMatches = await Course.find({
                ...queryObj,
                $or: [
                    { courseName: new RegExp(`^${exactSearchQuery}$`, 'i') },
                    { courseCode: new RegExp(`^${exactSearchQuery}$`, 'i') }
                ]
            });

            if (exactMatches.length > 0) {
                courses = exactMatches;
            } else {
                // 2. Fallback to Keyword Match
                // Extract useful keywords (length > 2)
                const keywords = exactSearchQuery.split(/[\s,]+/).filter(word => word.length > 2);
                if (keywords.length > 0) {
                    const regexArray = keywords.map(kw => new RegExp(kw, 'i'));
                    const keywordMatches = await Course.find({
                        ...queryObj,
                        $or: [
                            { courseName: { $in: regexArray } },
                            { courseCode: { $in: regexArray } }
                        ]
                    });
                    courses = keywordMatches;
                } else {
                    // Fall back to just technology filter
                    courses = await Course.find(queryObj);
                }
            }
        } else {
            // No query provided, return all for the technology
            courses = await Course.find(queryObj);
        }

        res.status(200).json(courses);
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

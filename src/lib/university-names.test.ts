import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeUniversityName, universityNameKeys, universitySearchVariants } from './university-names.ts';

test('canonicalizes only the institution prefix and keeps Kemenkes and suffix intact', () => {
    assert.equal(canonicalizeUniversityName(' Politeknik Kesehatan Kemenkes Bandung '), 'Poltekkes Kemenkes Bandung');
    assert.equal(canonicalizeUniversityName('POLITEKNIK KESEHATAN Bhakti Mulia'), 'Poltekkes Bhakti Mulia');
    assert.equal(canonicalizeUniversityName('Poltekkes Kemenkes Bandung'), 'Poltekkes Kemenkes Bandung');
    assert.equal(canonicalizeUniversityName('Akademi Politeknik Kesehatan'), 'Akademi Politeknik Kesehatan');
    assert.equal(canonicalizeUniversityName('Politeknik Kesehatanan'), 'Politeknik Kesehatanan');
    assert.equal(canonicalizeUniversityName(null), '');
});

test('duplicate detection includes canonical and legacy normalized names in either direction', () => {
    const keys = ['poltekkes bhakti mulia', 'politeknik kesehatan bhakti mulia'];
    assert.deepEqual(universityNameKeys('Poltekkes Bhakti Mulia').sort(), keys.sort());
    assert.deepEqual(universityNameKeys('Politeknik Kesehatan Bhakti Mulia').sort(), keys.sort());
    assert.deepEqual(universityNameKeys('Universitas Bandung'), ['universitas bandung']);
});

test('search supports both labels without modifying other university terms', () => {
    assert.deepEqual(universitySearchVariants('Poltekkes Bandung'), ['Poltekkes Bandung', 'Politeknik Kesehatan Bandung']);
    assert.deepEqual(universitySearchVariants('Politeknik Kesehatan Bandung'), ['Politeknik Kesehatan Bandung', 'Poltekkes Bandung']);
    assert.deepEqual(universitySearchVariants(' Bandung '), ['Bandung']);
});

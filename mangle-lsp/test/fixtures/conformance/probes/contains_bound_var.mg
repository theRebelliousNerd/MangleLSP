# A string-test pattern may be a variable bound earlier: accepted.
needle("ab"). hay("xxabyy").
hit(H) :- hay(H), needle(N), :string:contains(H, N).
